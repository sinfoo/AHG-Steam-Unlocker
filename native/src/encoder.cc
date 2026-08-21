/**
 * encoder.cc — RGBA → WebP file output via libwebp.
 *
 * encodeWebP(data: Buffer, width: number, height: number, quality?: number) → Buffer
 */
#include "native_image.h"
#include <webp/encode.h>

std::vector<uint8_t> encodeWebPRGBA(const uint8_t* rgba, uint32_t w, uint32_t h, float quality) {
  if (!rgba || w == 0 || h == 0 || w > 16384 || h > 16384) return {};

  uint8_t* output = nullptr;
  size_t outSize = WebPEncodeRGBA(rgba, static_cast<int>(w), static_cast<int>(h),
                                   static_cast<int>(w) * 4, quality, &output);
  if (outSize == 0 || !output) return {};

  std::vector<uint8_t> result(output, output + outSize);
  WebPFree(output);
  return result;
}

Napi::Value EncodeWebP(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  if (info.Length() < 3) {
    Napi::TypeError::New(env, "Expected (buffer, width, height[, quality])").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Buffer arg
  size_t len = 0;
  auto* buf = getBufferData<uint8_t>(info, 0, &len);
  if (!buf) {
    Napi::TypeError::New(env, "First argument must be a Buffer (RGBA data)").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  ARG_INT(width,  1, "width");
  ARG_INT(height, 2, "height");

  // Expected byte count check
  if (static_cast<size_t>(width) * height * 4 != len) {
    Napi::Error::New(env, "Buffer size does not match width × height × 4")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  float quality = 82.0f; // default: 82 (matches libwebp / sharp default)
  if (info.Length() >= 4 && info[3].IsNumber()) {
    quality = info[3].As<Napi::Number>().FloatValue();
    if (quality < 0.0f) quality = 0.0f;
    if (quality > 100.0f) quality = 100.0f;
  }

  auto webp = encodeWebPRGBA(buf, static_cast<uint32_t>(width),
                              static_cast<uint32_t>(height), quality);
  if (webp.empty()) {
    Napi::Error::New(env, "WebP encode failed").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  return Napi::Buffer<uint8_t>::Copy(env, webp.data(), webp.size());
}
