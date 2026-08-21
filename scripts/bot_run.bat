@echo off
title AHG Discord Bot
cd /d "%~dp0"
setlocal enabledelayedexpansion

for /f "delims=#" %%a in ('"prompt #$E# & for %%b in (1) do rem"') do set "ESC=%%a"

set "GREEN=%ESC%[32m"
set "BOLD_GREEN=%ESC%[1;32m"
set "BOLD_RED=%ESC%[1;31m"
set "YELLOW=%ESC%[33m"
set "BOLD_CYAN=%ESC%[1;36m"
set "WHITE=%ESC%[37m"
set "RESET=%ESC%[0m"

cls
echo %BOLD_GREEN%  +=======================================+%RESET%
echo %BOLD_GREEN%  ^|%RESET%     %BOLD_GREEN%AHG - DISCORD BOT%RESET%                 %BOLD_GREEN%^|%RESET%
echo %BOLD_GREEN%  +=======================================+%RESET%
echo.

echo %BOLD_CYAN%  ---[ Checking Environment ]---%RESET%
echo.

REM --- Load tokens from config/secrets.json ---
if exist "..\config\secrets.json" (
    echo %WHITE%  [..] Loading secrets from config/secrets.json...%RESET%
    for /f "usebackq delims=" %%a in (`powershell -NoProfile -Command "$s=Get-Content '..\config\secrets.json'|ConvertFrom-Json; Write-Output ('DISCORD_BOT_TOKEN='+$s.discordBotToken); Write-Output ('GITHUB_TOKEN='+$s.githubToken)"`) do set "%%a"
    if "!DISCORD_BOT_TOKEN!"=="" (
        echo %BOLD_RED%  [!!] DISCORD_BOT_TOKEN not found in config/secrets.json%RESET%
        pause
        exit /b 1
    )
    if "!GITHUB_TOKEN!"=="" (
        echo %BOLD_RED%  [!!] GITHUB_TOKEN not found in config/secrets.json%RESET%
        pause
        exit /b 1
    )
    echo %GREEN%  [OK] Tokens loaded%RESET%
) else if "%DISCORD_BOT_TOKEN%"=="" (
    echo %BOLD_RED%  [!!] config/secrets.json not found and DISCORD_BOT_TOKEN env var not set%RESET%
    echo %YELLOW%         Either create ..\config\secrets.json or set DISCORD_BOT_TOKEN and GITHUB_TOKEN as env vars%RESET%
    pause
    exit /b 1
) else (
    echo %GREEN%  [OK] Using DISCORD_BOT_TOKEN from environment%RESET%
)

echo.
echo %WHITE%  [..] Checking dependencies...%RESET%
REM Only hit the network when something is actually missing — this used to run
REM pip on every single start, costing seconds and requiring connectivity.
python -c "import discord, requests" >nul 2>&1
if !errorlevel! neq 0 (
    echo %YELLOW%  [..] Missing packages, installing...%RESET%
    pip install discord.py requests >nul 2>&1
    if !errorlevel! neq 0 (
        echo %YELLOW%  [!!] pip failed, trying python -m pip...%RESET%
        python -m pip install discord.py requests >nul 2>&1
    )
    python -c "import discord, requests" >nul 2>&1
    if !errorlevel! neq 0 (
        echo %BOLD_RED%  [!!] Failed to install dependencies. Run manually:%RESET%
        echo %YELLOW%         pip install discord.py requests%RESET%
        pause
        exit /b 1
    )
)
echo %GREEN%  [OK] Dependencies ready%RESET%

echo.
echo %WHITE%  [..] Checking DNS for discord.com...%RESET%
nslookup discord.com >nul 2>&1
if !errorlevel! neq 0 (
    echo %YELLOW%  [!!] DNS lookup failed. Flushing cache...%RESET%
    ipconfig /flushdns >nul 2>&1
    timeout /t 3 /nobreak >nul
    nslookup discord.com >nul 2>&1
    if !errorlevel! neq 0 (
        echo %BOLD_RED%  [!!] Cannot resolve discord.com. Check your connection.%RESET%
        pause
        exit /b 1
    )
    echo %GREEN%  [OK] DNS restored%RESET%
) else (
    echo %GREEN%  [OK] discord.com resolved%RESET%
)

echo.
echo %BOLD_CYAN%  ---[ Starting Discord Bot ]---%RESET%
echo.

set retries=3
:retry_loop
REM -u keeps stdout unbuffered: without it Python buffers when output is piped or
REM redirected to a log, so none of the bot's own status lines ever show up.
python -u python\utils\bot.py
if !errorlevel! neq 0 (
    set /a retries-=1
    if !retries! gtr 0 (
        echo %YELLOW%  [!!] Crashed. Retrying in 5s... (!retries! left)%RESET%
        timeout /t 5 /nobreak >nul
        goto retry_loop
    )
    echo %BOLD_RED%  [!!] Bot failed after 3 attempts.%RESET%
    pause
)
