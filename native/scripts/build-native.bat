@echo off
setlocal enabledelayedexpansion

REM ──────────────────────────────────────────────────────────────────────────
REM  build-native.bat — Build the native_image addon via node-gyp.
REM
REM  Usage:
REM    build-native.bat            Build release (default)
REM    build-native.bat debug      Build debug (no optimizations)
REM    build-native.bat clean      Remove build artifacts
REM    build-native.bat rebuild    Full clean + build
REM
REM  Prerequisites:
REM    - node-gyp installed (npm install -g node-gyp or local devDependency)
REM    - VS 2022 Build Tools with "Desktop development with C++" workload
REM    - vcpkg with libwebp and libjpeg-turbo installed
REM    - npm packages: node-addon-api
REM ──────────────────────────────────────────────────────────────────────────

set PROJECT_DIR=%~dp0..
set VCPKG_ROOT=%USERPROFILE%\vcpkg

REM ── Validate vcpkg ──────────────────────────────────────────────────────
if not exist "%VCPKG_ROOT%\vcpkg.exe" (
    echo [ERROR] vcpkg not found at %VCPKG_ROOT%
    echo         Install it first: git clone https://github.com/Microsoft/vcpkg.git %%USERPROFILE%%\vcpkg
    echo         Then run: vcpkg\bootstrap-vcpkg.bat
    exit /b 1
)

if not exist "%VCPKG_ROOT%\installed\x64-windows\include\webp\decode.h" (
    echo [ERROR] libwebp not found. Install via:
    echo         vcpkg install libwebp libjpeg-turbo --triplet x64-windows
    exit /b 1
)

REM ── Detect node-gyp ─────────────────────────────────────────────────────
REM Prefer local npx to avoid version conflicts with global installs.
if exist "%PROJECT_DIR%\..\node_modules\.bin\node-gyp.cmd" (
    set NODE_GYP=npx node-gyp
) else (
    where node-gyp >nul 2>nul
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] node-gyp not found. Install via: npm install
        exit /b 1
    ) else (
        set NODE_GYP=node-gyp
    )
)

cd /d "%PROJECT_DIR%"

REM ── Parse command ───────────────────────────────────────────────────────
set MODE=%1
if "%MODE%"=="" set MODE=release

if /i "%MODE%"=="clean" (
    echo [BUILD] Cleaning build artifacts...
    rmdir /s /q build 2>nul
    rmdir /s /q .node-gyp 2>nul
    echo [BUILD] Clean complete.
    exit /b 0
)

if /i "%MODE%"=="rebuild" (
    echo [BUILD] Full rebuild...
    rmdir /s /q build 2>nul
    set MODE=release
)

REM ── Build ───────────────────────────────────────────────────────────────
set VCPKG_FLAG=--variable=vcpkg_root=%VCPKG_ROOT%

if /i "%MODE%"=="debug" (
    echo [BUILD] Building DEBUG...
    %NODE_GYP% rebuild --debug --verbose %VCPKG_FLAG%
) else (
    echo [BUILD] Building RELEASE...
    %NODE_GYP% rebuild --verbose %VCPKG_FLAG%
)

if %ERRORLEVEL% neq 0 (
    echo [ERROR] Build failed.
    exit /b %ERRORLEVEL%
)

REM ── Verify output ───────────────────────────────────────────────────────
set NODE_FILE=build\Release\ahg-native-image.node
if /i "%MODE%"=="debug" set NODE_FILE=build\Debug\ahg-native-image.node

if exist "%NODE_FILE%" (
    echo [BUILD] Success! Output: %NODE_FILE%
    dir /b "%NODE_FILE%"
) else (
    echo [WARNING] Build completed but output not found at %NODE_FILE%
)

exit /b 0
