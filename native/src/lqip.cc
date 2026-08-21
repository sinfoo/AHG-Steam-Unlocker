/**
 * lqip.cc — 20px thumbnail → base64 WebP data URL.
 *
 * Downsamples RGBA pixels with simple box filter (fastest path for 20px thumb),
 * encodes as low-quality WebP (quality=20), and returns a data URL string.
 *
 * generateLQIP(data: Buffer, width: number, height: number, maxSize?: number) → string
 */
#include "native_image.h"
#include <webp/encode.h>
#include <vector>
#include <string>
#include <cmath>

/**
 * 2×2 box downsample — produces a thumbnail at maxDimension on the longest edge.
 * Simple area-averaging: each output pixel = average of floor(N) × floor(M) input pixels.
 */
static std::vector<uint8_t> downsampleBox(const uint8_t* rgba, uint32_t srcW, uint32_t srcH,
                                           uint32_t dstW, uint32_t dstH) {
  std::vector<uint8_t> out(dstW * dstH * 4, 0);

  for (uint32_t dy = 0; dy < dstH; ++dy) {
    // Source Y range this output row covers
    float srcYStartF  = (static_cast<float>(dy)      / dstH) * srcH;
    float srcYEndF    = (static_cast<float>(dy + 1)  / dstH) * srcH;
    uint32_t srcYStart = static_cast<uint32_t>(std::floor(srcYStartF));
    uint32_t srcYEnd   = std::min(static_cast<uint32_t>(std::ceil(srcYEndF)), srcH);
    if (srcYEnd <= srcYStart) srcYEnd = srcYStart + 1;
    uint32_t yCount = srcYEnd - srcYStart;

    for (uint32_t dx = 0; dx < dstW; ++dx) {
      float srcXStartF = (static_cast<float>(dx)     / dstW) * srcW;
      float srcXEndF   = (static_cast<float>(dx + 1) / dstW) * srcW;
      uint32_t srcXStart = static_cast<uint32_t>(std::floor(srcXStartF));
      uint32_t srcXEnd   = std::min(static_cast<uint32_t>(std::ceil(srcXEndF)), srcW);
      if (srcXEnd <= srcXStart) srcXEnd = srcXStart + 1;
      uint32_t xCount = srcXEnd - srcXStart;

      uint32_t r = 0, g = 0, b = 0, a = 0, count = 0;
      for (uint32_t sy = srcYStart; sy < srcYEnd; ++sy) {
        const uint8_t* row = rgba + (static_cast<size_t>(sy) * srcW + srcXStart) * 4;
        for (uint32_t sx = srcXStart; sx < srcXEnd; ++sx) {
          r += row[0]; g += row[1]; b += row[2]; a += row[3];
          row += 4;
          ++count;
        }
      }

      if (count == 0) continue;
      uint8_t* dst = out.data() + (static_cast<size_t>(dy) * dstW + dx) * 4;
      dst[0] = static_cast<uint8_t>(r / count);
      dst[1] = static_cast<uint8_t>(g / count);
      dst[2] = static_cast<uint8_t>(b / count);
      dst[3] = static_cast<uint8_t>(a / count);
    }
  }
  return out;
}

static const char kBase64Table[] =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

static std::string base64Encode(const uint8_t* data, size_t len) {
  std::string result;
  result.reserve(((len + 2) / 3) * 4);
  for (size_t i = 0; i < len; i += 3) {
    uint32_t triple = (static_cast<uint32_t>(data[i]) << 16);
    if (i + 1 < len) triple |= (static_cast<uint32_t>(data[i + 1]) << 8);
    if (i + 2 < len) triple |= data[i + 2];
    result += kBase64Table[(triple >> 18) & 0x3F];
    result += kBase64Table[(triple >> 12) & 0x3F];
    result += (i + 1 < len) ? kBase64Table[(triple >> 6) & 0x3F] : '=';
    result += (i + 2 < len) ? kBase64Table[triple & 0x3F] : '=';
  }
  return result;
}

std::string lqipFromRGBA(const uint8_t* rgba, uint32_t w, uint32_t h, uint32_t maxDimension) {
  if (!rgba || w == 0 || h == 0) return {};

  // Compute thumbnail dimensions preserving aspect ratio
  uint32_t dstW, dstH;
  if (w >= h) {
    dstW = maxDimension;
    dstH = std::max(1u, static_cast<uint32_t>(std::round(static_cast<float>(h) / w * maxDimension)));
  } else {
    dstH = maxDimension;
    dstW = std::max(1u, static_cast<uint32_t>(std::round(static_cast<float>(w) / h * maxDimension)));
  }

  auto thumb = downsampleBox(rgba, w, h, dstW, dstH);
  if (thumb.empty()) return {};

  // Encode as low-quality WebP
  size_t outSize = 0;
  uint8_t* webpData = nullptr;
  // quality=20 gives ~500-800 bytes for a 20px thumbnail
  outSize = WebPEncodeLosslessRGBA(thumb.data(), dstW, dstH, dstW * 4, &webpData);
  if (outSize == 0 || !webpData) {
    // Fallback to lossy with very low quality
    outSize = WebPEncodeRGBA(thumb.data(), dstW, dstH, dstW * 4, 20.0f, &webpData);
  }
  if (outSize == 0 || !webpData) return {};

  std::string b64 = base64Encode(webpData, outSize);
  WebPFree(webpData);

  return "data:image/webp;base64," + b64;
}

Napi::Value GenerateLQIP(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  if (info.Length() < 3) {
    Napi::TypeError::New(env, "Expected (buffer, width, height[, maxSize])").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  size_t len = 0;
  auto* buf = getBufferData<uint8_t>(info, 0, &len);
  if (!buf) {
    Napi::TypeError::New(env, "First argument must be a Buffer (RGBA data)").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  ARG_INT(width,  1, "width");
  ARG_INT(height, 2, "height");

  if (static_cast<size_t>(width) * height * 4 != len) {
    Napi::Error::New(env, "Buffer size does not match width × height × 4").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  uint32_t maxSize = 20;
  if (info.Length() >= 4 && info[3].IsNumber()) {
    int ms = info[3].As<Napi::Number>().Int32Value();
    if (ms > 0 && ms <= 200) maxSize = static_cast<uint32_t>(ms);
  }

  std::string dataUrl = lqipFromRGBA(buf, static_cast<uint32_t>(width),
                                      static_cast<uint32_t>(height), maxSize);
  if (dataUrl.empty()) {
    Napi::Error::New(env, "LQIP generation failed").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  return Napi::String::New(env, dataUrl);
}
