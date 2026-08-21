/**
 * gpu.cc — D3D11 device init + shared memory (optional tier).
 *
 * Currently provides capability detection only. The GPU tier enables
 * direct pixel upload to GPU VRAM via D3D11 textures, bypassing the
 * browser's image decode pipeline entirely.
 *
 * isGPUSupported() → boolean
 */
#include "native_image.h"

#ifdef _WIN32
#include <windows.h>
#include <d3d11.h>
#include <dxgi1_2.h>
#pragma comment(lib, "dxgi.lib")
#pragma comment(lib, "d3d11.lib")
#endif

Napi::Value IsGPUSupported(const Napi::CallbackInfo& info) {
  auto env = info.Env();

#ifdef _WIN32
  // Feature level levels to check
  D3D_FEATURE_LEVEL levels[] = {
    D3D_FEATURE_LEVEL_11_1,
    D3D_FEATURE_LEVEL_11_0,
    D3D_FEATURE_LEVEL_10_1,
    D3D_FEATURE_LEVEL_10_0
  };

  ID3D11Device* device = nullptr;
  ID3D11DeviceContext* context = nullptr;
  D3D_FEATURE_LEVEL obtained;

  HRESULT hr = D3D11CreateDevice(
    nullptr,                       // default adapter
    D3D_DRIVER_TYPE_HARDWARE,      // hardware GPU
    nullptr,                       // no software rasterizer
    0,                             // flags
    levels,                        // feature levels
    ARRAYSIZE(levels),             // count
    D3D11_SDK_VERSION,
    &device,
    &obtained,
    &context
  );

  if (SUCCEEDED(hr) && device) {
    // Check for compute shader support (SM 5.0+)
    D3D11_FEATURE_DATA_D3D11_OPTIONS options{};
    HRESULT hrOpt = device->CheckFeatureSupport(
      D3D11_FEATURE_D3D11_OPTIONS,
      &options,
      sizeof(options)
    );

    device->Release();
    if (context) context->Release();

    if (SUCCEEDED(hrOpt)) {
      return Napi::Boolean::New(env, true);
    }
    return Napi::Boolean::New(env, obtained >= D3D_FEATURE_LEVEL_11_0);
  }

  if (device) device->Release();
  if (context) context->Release();
  return Napi::Boolean::New(env, false);
#else
  return Napi::Boolean::New(env, false);
#endif // _WIN32
}
