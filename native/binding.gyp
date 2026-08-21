{
  "targets": [
    {
      "target_name": "ahg-native-image",
      "sources": [
        "src/main.cc",
        "src/decoder.cc",
        "src/encoder.cc",
        "src/lqip.cc",
        "src/batch.cc",
        "src/gpu.cc"
      ],
      "include_dirs": [
        "include",
        "../node_modules/node-addon-api",
        "<(vcpkg_root)/installed/x64-windows/include"
      ],
      "libraries": [
        "-l<(vcpkg_root)/installed/x64-windows/lib/libwebp.lib",
        "-l<(vcpkg_root)/installed/x64-windows/lib/libwebpdecoder.lib",
        "-l<(vcpkg_root)/installed/x64-windows/lib/libwebpdemux.lib",
        "-l<(vcpkg_root)/installed/x64-windows/lib/jpeg.lib",
        "-l<(vcpkg_root)/installed/x64-windows/lib/turbojpeg.lib"
      ],
      "defines": [
        "NAPI_VERSION=9",
        "NODE_ADDON_API_DISABLE_CPP_EXCEPTIONS"
      ],
      "msvs_settings": {
        "VCCLCompilerTool": {
          "Optimization": "MaxSpeed"
        },
        "VCLinkerTool": {
          "EnableCOMDATFolding": "1",
          "OptimizeReferences": "2"
        }
      },
      "conditions": [
        ["OS=='win'", {
          "libraries": [
            "-ld3d11.lib",
            "-ldxgi.lib"
          ]
        }]
      ]
    }
  ],
  "variables": {
    "vcpkg_root%": "C:/Users/sinfo/vcpkg"
  }
}
