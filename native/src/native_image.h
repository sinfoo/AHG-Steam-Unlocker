/**
 * native_image.h — Shared types, helpers, and function declarations
 * for the AHG native image processing addon.
 *
 * All .cc files in this module include this header.
 * Uses node-addon-api (N-API) for JavaScript interop.
 */
#pragma once

#include <napi.h>
#include <vector>
#include <cstdint>
#include <string>

// ─────────────────────────────────────────────────────────────────────────────
//  Error / result structs
// ─────────────────────────────────────────────────────────────────────────────

struct DecodedImage {
  uint32_t width = 0;
  uint32_t height = 0;
  std::vector<uint8_t> data;
  bool valid = false;
};

struct BatchItem {
  uint32_t width = 0;
  uint32_t height = 0;
  std::vector<uint8_t> data;
  bool valid = false;
};

// ─────────────────────────────────────────────────────────────────────────────
//  N-API helper: extract typed Buffer from arguments
// ─────────────────────────────────────────────────────────────────────────────

template <typename T>
T* getBufferData(const Napi::CallbackInfo& info, int index, size_t* outLen) {
  if (index < 0 || index >= static_cast<int>(info.Length())) return nullptr;
  auto val = info[index];
  if (!val.IsBuffer()) return nullptr;
  auto buf = val.As<Napi::Buffer<T>>();
  if (outLen) *outLen = buf.Length() / sizeof(T);
  return buf.Data();
}

// ─────────────────────────────────────────────────────────────────────────────
//  Macro: extract integer argument with bounds check
// ─────────────────────────────────────────────────────────────────────────────

#define ARG_INT(var, idx, label) \
  if (idx >= static_cast<int>(info.Length()) || !info[idx].IsNumber()) { \
    Napi::TypeError::New(env, "Expected a number for " label) \
        .ThrowAsJavaScriptException(); \
    return env.Undefined(); \
  } \
  int var = info[idx].As<Napi::Number>().Int32Value();

// ─────────────────────────────────────────────────────────────────────────────
//  Internal function declarations
// ─────────────────────────────────────────────────────────────────────────────

// decoder.cc
DecodedImage decodeWebPBuffer(const uint8_t* data, size_t size);
DecodedImage decodeJPEGBuffer(const uint8_t* data, size_t size);

// encoder.cc
std::vector<uint8_t> encodeWebPRGBA(const uint8_t* rgba, uint32_t w, uint32_t h,
                                     float quality);

// lqip.cc
std::string lqipFromRGBA(const uint8_t* rgba, uint32_t w, uint32_t h,
                          uint32_t maxDimension);

// ─────────────────────────────────────────────────────────────────────────────
//  N-API exported function declarations
// ─────────────────────────────────────────────────────────────────────────────

Napi::Value DecodeWebP(const Napi::CallbackInfo& info);
Napi::Value DecodeJPEG(const Napi::CallbackInfo& info);
Napi::Value EncodeWebP(const Napi::CallbackInfo& info);
Napi::Value GenerateLQIP(const Napi::CallbackInfo& info);
Napi::Value BatchDecode(const Napi::CallbackInfo& info);
Napi::Value IsGPUSupported(const Napi::CallbackInfo& info);
