/**
 * batch.cc — Thread-pool parallel batch decode using std::thread.
 *
 * Accepts an array of { data: Buffer, type: 'webp'|'jpeg' } objects.
 * Decodes up to `concurrency` images in parallel using a fixed thread pool.
 * Returns array of { data: Buffer, width, height, index } in original order.
 *
 * batchDecode(images: BatchInput[], concurrency?: number) → BatchOutput[]
 */
#include "native_image.h"
#include <webp/decode.h>
#include <jpeglib.h>
#include <thread>
#include <vector>
#include <atomic>
#include <functional>
#include <csetjmp>

// ─────────────────────────────────────────────────────────────────────────────
//  JPEG decode helpers (thread-safe: each call has its own cinfo)
// ─────────────────────────────────────────────────────────────────────────────

struct LocalJpegErr { jpeg_error_mgr pub; jmp_buf buf; };

static void jpegSilent(j_common_ptr) {}

static DecodedImage decodeJPEGBlocking(const uint8_t* data, size_t size) {
  DecodedImage result;
  if (!data || size < 2) return result;

  jpeg_decompress_struct cinfo;
  LocalJpegErr jerr;
  cinfo.err = jpeg_std_error(&jerr.pub);
  jerr.pub.error_exit = [](j_common_ptr c) {
    auto* e = reinterpret_cast<LocalJpegErr*>(c->err);
    longjmp(e->buf, 1);
  };
  // Suppress stderr output from libjpeg
  jerr.pub.output_message = jpegSilent;

  if (setjmp(jerr.buf)) {
    jpeg_destroy_decompress(&cinfo);
    return result;
  }

  jpeg_create_decompress(&cinfo);
  jpeg_mem_src(&cinfo, data, size);
  jpeg_read_header(&cinfo, TRUE);
  cinfo.out_color_space = JCS_EXT_RGBA;
  jpeg_start_decompress(&cinfo);

  result.width  = cinfo.output_width;
  result.height = cinfo.output_height;
  size_t stride = static_cast<size_t>(result.width) * 4;
  result.data.resize(stride * result.height);

  while (cinfo.output_scanline < cinfo.output_height) {
    uint8_t* row = result.data.data() + stride * cinfo.output_scanline;
    jpeg_read_scanlines(&cinfo, &row, 1);
  }

  jpeg_finish_decompress(&cinfo);
  jpeg_destroy_decompress(&cinfo);
  result.valid = true;
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Per-image decode dispatch
// ─────────────────────────────────────────────────────────────────────────────

static BatchItem decodeSingle(const uint8_t* data, size_t size, const std::string& type) {
  BatchItem item;
  DecodedImage img;
  if (type == "webp" || type == "webp") {
    img = decodeWebPBuffer(data, size);
  } else if (type == "jpeg" || type == "jpg") {
    img = decodeJPEGBlocking(data, size);
  } else {
    // Try WebP first, then JPEG
    img = decodeWebPBuffer(data, size);
    if (!img.valid) img = decodeJPEGBlocking(data, size);
  }
  if (img.valid) {
    item.data   = std::move(img.data);
    item.width  = img.width;
    item.height = img.height;
    item.valid  = true;
  }
  return item;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Thread pool
// ─────────────────────────────────────────────────────────────────────────────

struct WorkItem {
  const uint8_t* data;
  size_t size;
  std::string type;
  uint32_t index;
  BatchItem* out;
};

static void workerLoop(std::atomic<int>* nextIdx, int total,
                       std::vector<WorkItem>* items, std::atomic<int>* done) {
  while (true) {
    int idx = (*nextIdx)++;
    if (idx >= total) return;
    auto& w = (*items)[idx];
    *w.out = decodeSingle(w.data, w.size, w.type);
    done->fetch_add(1, std::memory_order_relaxed);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  N-API wrapper
// ─────────────────────────────────────────────────────────────────────────────

Napi::Value BatchDecode(const Napi::CallbackInfo& info) {
  auto env = info.Env();

  if (info.Length() < 1 || !info[0].IsArray()) {
    Napi::TypeError::New(env, "Expected an array as first argument")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  auto inputArr = info[0].As<Napi::Array>();
  uint32_t count = inputArr.Length();
  if (count == 0) return Napi::Array::New(env, 0);

  // Concurrency: default = hardware concurrency
  int concurrency = static_cast<int>(std::thread::hardware_concurrency());
  if (concurrency < 1) concurrency = 4;
  if (info.Length() >= 2 && info[1].IsNumber()) {
    int c = info[1].As<Napi::Number>().Int32Value();
    if (c > 0 && c <= 64) concurrency = c;
  }

  // Allocate results upfront
  std::vector<BatchItem> results(count);

  // Parse input into work items
  std::vector<WorkItem> workItems;
  workItems.reserve(count);

  for (uint32_t i = 0; i < count; ++i) {
    auto val = inputArr.Get(i);
    if (!val.IsObject()) {
      results[i].valid = false;
      continue;
    }
    auto obj = val.As<Napi::Object>();

    auto typeVal = obj.Get("type");
    std::string type = "webp";
    if (typeVal.IsString()) type = typeVal.As<Napi::String>().Utf8Value();

    auto bufVal = obj.Get("data");
    if (!bufVal.IsBuffer()) {
      results[i].valid = false;
      continue;
    }
    auto buf = bufVal.As<Napi::Buffer<uint8_t>>();
    size_t bufLen = buf.Length();
    auto* bufData = buf.Data();

    if (bufLen == 0) {
      results[i].valid = false;
      continue;
    }

    workItems.push_back({bufData, bufLen, std::move(type), i, &results[i]});
  }

  // Process in thread pool
  std::atomic<int> nextIdx{0};
  std::atomic<int> done{0};

  int actualThreads = std::min(concurrency, static_cast<int>(workItems.size()));
  std::vector<std::thread> threads;
  threads.reserve(actualThreads);

  for (int t = 0; t < actualThreads; ++t) {
    threads.emplace_back(workerLoop, &nextIdx,
                         static_cast<int>(workItems.size()), &workItems, &done);
  }
  for (auto& t : threads) t.join();

  // Build output array in original order
  auto outArr = Napi::Array::New(env, count);
  for (uint32_t i = 0; i < count; ++i) {
    auto obj = Napi::Object::New(env);
    if (results[i].valid) {
      obj.Set("data",   Napi::Buffer<uint8_t>::Copy(env, results[i].data.data(),
                                                     results[i].data.size()));
      obj.Set("width",  Napi::Number::New(env, results[i].width));
      obj.Set("height", Napi::Number::New(env, results[i].height));
    } else {
      obj.Set("data",   env.Null());
      obj.Set("width",  Napi::Number::New(env, 0));
      obj.Set("height", Napi::Number::New(env, 0));
    }
    obj.Set("index", Napi::Number::New(env, i));
    outArr.Set(i, obj);
  }

  return outArr;
}
