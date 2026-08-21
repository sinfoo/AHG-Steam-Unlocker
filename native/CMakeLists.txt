cmake_minimum_required(VERSION 3.20)
project(ahg-native-image
  VERSION 1.0.0
  LANGUAGES CXX
)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreadedDLL")

# ── Find dependencies ────────────────────────────────────────────────────
find_package(WebP CONFIG REQUIRED)
find_package(libjpeg-turbo CONFIG REQUIRED)

# ── node-addon-api via FetchContent ──────────────────────────────────────
include(FetchContent)
FetchContent_Declare(
  node-addon-api
  GIT_REPOSITORY https://github.com/nodejs/node-addon-api.git
  GIT_TAG v8.3.1
)
FetchContent_MakeAvailable(node-addon-api)

# ── Node.js headers ──────────────────────────────────────────────────────
execute_process(
  COMMAND node -p "require('node-wrap').include_path"
  OUTPUT_VARIABLE NODE_INCLUDE_DIR
  OUTPUT_STRIP_TRAILING_WHITESPACE
  ERROR_QUIET
)
if(NOT NODE_INCLUDE_DIR)
  execute_process(
    COMMAND node -e "process.stdout.write(process.config.variables.node_install_npm ? require('path').dirname(require('path').join(process.execPath, '..', '..', 'include', 'node')) : '')"
    OUTPUT_VARIABLE NODE_INCLUDE_DIR
    OUTPUT_STRIP_TRAILING_WHITESPACE
  )
endif()

# ── Sources ──────────────────────────────────────────────────────────────
set(SOURCES
  src/main.cc
  src/decoder.cc
  src/encoder.cc
  src/lqip.cc
  src/batch.cc
  src/gpu.cc
)

# ── Shared library (Node.js addon) ───────────────────────────────────────
add_library(${PROJECT_NAME} SHARED ${SOURCES})
set_target_properties(${PROJECT_NAME} PROPERTIES
  PREFIX ""
  SUFFIX ".node"
)

target_include_directories(${PROJECT_NAME} PRIVATE
  src
  include
  ${NODE_INCLUDE_DIR}
  ${CMAKE_CURRENT_BINARY_DIR}/_deps/node-addon-api-src
)

target_link_libraries(${PROJECT_NAME} PRIVATE
  WebP::webp
  WebP::webpdecoder
  WebP::webpdemux
  libjpeg-turbo::turbojpeg
)

target_compile_definitions(${PROJECT_NAME} PRIVATE
  NAPI_VERSION=9
  NODE_ADDON_API_ENABLE_MAYBE
)

if(WIN32)
  target_link_libraries(${PROJECT_NAME} PRIVATE d3d11 dxgi)
endif()
