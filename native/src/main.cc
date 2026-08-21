/**
 * main.cc — N-API module registration.
 *
 * Exports all image processing functions as a single native module.
 * Build with: node-gyp rebuild (or cmake-js rebuild)
 */
#include "native_image.h"

static Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("decodeWebP",      Napi::Function::New(env, DecodeWebP));
  exports.Set("decodeJPEG",      Napi::Function::New(env, DecodeJPEG));
  exports.Set("encodeWebP",      Napi::Function::New(env, EncodeWebP));
  exports.Set("generateLQIP",    Napi::Function::New(env, GenerateLQIP));
  exports.Set("batchDecode",     Napi::Function::New(env, BatchDecode));
  exports.Set("isGPUSupported",  Napi::Function::New(env, IsGPUSupported));
  return exports;
}

NODE_API_MODULE(NODE_GYP_MODULE_NAME, Init)
