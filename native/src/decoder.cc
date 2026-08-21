/**
 * decoder.cc — WebP + JPEG single-image decode via libwebp / libjpeg-turbo.
 *
 * Both functions accept a Node.js Buffer and return { data: Buffer, width, height }.
 * Decoded pixels are RGBA 8-bit, row-major (stride = width * 4).
 */
#include "native_image.h"
#include <webp/decode.h>
#include <jpeglib.h>
#include <vector>
#include <csetjmp>

// ─────────────────────────────────────────────────────────────────────────────
//  WebP decode
// ─────────────────────────────────────────────────────────────────────────────

DecodedImage decodeWebPBuffer(const uint8_t* data, size_t size) {
  DecodedImage result;

  if (!data || size < 4) return result;

  int w = 0, h = 0;
  // Quick feature check — returns 0 on invalid data
  if (!WebPGetInfo(data, size, &w, &h)) return result;
  if (w <= 0 || h <= 0 || w > 16384 || h > 16384) return result;

  uint8_t* rgba = WebPDecodeRGBA(data, size, &w, &h);
  if (!rgba) return result;

  result.width  = static_cast<uint32_t>(w);
  result.height = static_cast<uint32_t>(h);
  result.data.assign(rgba, rgba + static_cast<size_t>(w) * h * 4);
  WebPFree(rgba);
  result.valid = true;
  return result;
}

Napi::Value DecodeWebP(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  if (info.Length() < 1) {
    Napi::TypeError::New(env, "Expected a Buffer argument").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  size_t len = 0;
  auto* buf = getBufferData<uint8_t>(info, 0, &len);
  if (!buf) {
    Napi::TypeError::New(env, "First argument must be a Buffer").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  auto img = decodeWebPBuffer(buf, len);
  if (!img.valid) {
    Napi::Error::New(env, "Failed to decode WebP image").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  auto obj = Napi::Object::New(env);
  obj.Set("data",   Napi::Buffer<uint8_t>::Copy(env, img.data.data(), img.data.size()));
  obj.Set("width",  Napi::Number::New(env, img.width));
  obj.Set("height", Napi::Number::New(env, img.height));
  return obj;
}

// ─────────────────────────────────────────────────────────────────────────────
//  JPEG decode  (libjpeg-turbo)
// ─────────────────────────────────────────────────────────────────────────────

struct JpegErrorMgr {
  jpeg_error_mgr pub;
  jmp_buf setjmpBuf;
};

static void jpegErrorExit(j_common_ptr cinfo) {
  auto* myErr = reinterpret_cast<JpegErrorMgr*>(cinfo->err);
  (*cinfo->err->output_message)(cinfo);
  longjmp(myErr->setjmpBuf, 1);
}

DecodedImage decodeJPEGBuffer(const uint8_t* data, size_t size) {
  DecodedImage result;
  if (!data || size < 2) return result;

  jpeg_decompress_struct cinfo;
  JpegErrorMgr jerr;

  cinfo.err = jpeg_std_error(&jerr.pub);
  jerr.pub.error_exit = jpegErrorExit;

  if (setjmp(jerr.setjmpBuf)) {
    jpeg_destroy_decompress(&cinfo);
    return result;
  }

  jpeg_create_decompress(&cinfo);
  jpeg_mem_src(&cinfo, data, size);
  jpeg_read_header(&cinfo, TRUE);

  // Force RGBA output
  cinfo.out_color_space = JCS_EXT_RGBA;

  jpeg_start_decompress(&cinfo);

  result.width  = cinfo.output_width;
  result.height = cinfo.output_height;
  size_t stride = static_cast<size_t>(result.width) * 4;
  result.data.resize(stride * result.height);

  // Read scanlines
  while (cinfo.output_scanline < cinfo.output_height) {
    uint8_t* row = result.data.data() + stride * cinfo.output_scanline;
    jpeg_read_scanlines(&cinfo, &row, 1);
  }

  jpeg_finish_decompress(&cinfo);
  jpeg_destroy_decompress(&cinfo);
  result.valid = true;
  return result;
}

Napi::Value DecodeJPEG(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  if (info.Length() < 1) {
    Napi::TypeError::New(env, "Expected a Buffer argument").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  size_t len = 0;
  auto* buf = getBufferData<uint8_t>(info, 0, &len);
  if (!buf) {
    Napi::TypeError::New(env, "First argument must be a Buffer").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  auto img = decodeJPEGBuffer(buf, len);
  if (!img.valid) {
    Napi::Error::New(env, "Failed to decode JPEG image").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  auto obj = Napi::Object::New(env);
  obj.Set("data",   Napi::Buffer<uint8_t>::Copy(env, img.data.data(), img.data.size()));
  obj.Set("width",  Napi::Number::New(env, img.width));
  obj.Set("height", Napi::Number::New(env, img.height));
  return obj;
}
