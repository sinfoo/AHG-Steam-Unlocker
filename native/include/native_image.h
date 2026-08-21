#ifndef NATIVE_IMAGE_H
#define NATIVE_IMAGE_H

#include <napi.h>
#include <vector>
#include <cstdint>
#include <string>
#include <cstring>

// ── Decoded image (RGBA pixels) ─────────────────────────────────────────
struct DecodedImage {
  std::vector<uint8_t> data;  // row-major RGBA, (width * height * 4) bytes
  uint32_t width  = 0;
  uint32_t height = 0;
  bool     valid  = false;
};

// ── Batch result ────────────────────────────────────────────────────────
struct BatchItem {
  std::vector<uint8_t> data;
  uint32_t width  = 0;
  uint32_t height = 0;
  bool     valid  = false;
};

// ── N-API exports (registered in main.cc) ───────────────────────────────
Napi::Value DecodeWebP(const Napi::CallbackInfo& info);
Napi::Value DecodeJPEG(const Napi::CallbackInfo& info);
Napi::Value EncodeWebP(const Napi::CallbackInfo& info);
Napi::Value GenerateLQIP(const Napi::CallbackInfo& info);
Napi::Value BatchDecode(const Napi::CallbackInfo& info);
Napi::Value IsGPUSupported(const Napi::CallbackInfo& info);

// ── Internal helpers ────────────────────────────────────────────────────
DecodedImage decodeWebPBuffer(const uint8_t* data, size_t size);
DecodedImage decodeJPEGBuffer(const uint8_t* data, size_t size);
std::vector<uint8_t> encodeWebPRGBA(const uint8_t* rgba, uint32_t w, uint32_t h, float quality);
std::string lqipFromRGBA(const uint8_t* rgba, uint32_t w, uint32_t h, uint32_t maxDimension);

// ── Validation helpers ──────────────────────────────────────────────────
template <typename T>
inline T* getBufferData(const Napi::CallbackInfo& info, int idx, size_t* outLen) {
  if (!info[idx].IsBuffer()) return nullptr;
  auto buf = info[idx].As<Napi::Buffer<T>>();
  *outLen = buf.Length();
  return reinterpret_cast<T*>(buf.Data());
}

#define ARG_INT(VAR, IDX, LABEL)                                         \
  if (!info[IDX].IsNumber()) {                                           \
    Napi::TypeError::New(env, "Expected number for " LABEL)              \
        .ThrowAsJavaScriptException();                                   \
    return env.Undefined();                                              \
  }                                                                      \
  int VAR = info[IDX].As<Napi::Number>().Int32Value();

#define ARG_FLOAT(VAR, IDX, LABEL)                                       \
  if (!info[IDX].IsNumber()) {                                           \
    Napi::TypeError::New(env, "Expected number for " LABEL)              \
        .ThrowAsJavaScriptException();                                   \
    return env.Undefined();                                              \
  }                                                                      \
  float VAR = info[IDX].As<Napi::Number>().FloatValue();

#endif // NATIVE_IMAGE_H
