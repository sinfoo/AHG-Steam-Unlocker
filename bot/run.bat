@echo off
title AHG Discord Bot
cd /d "%~dp0"
if not exist .env (
  echo [!!] bot\.env missing. Copy .env.example to .env and fill it in.
  pause & exit /b 1
)
python -c "import discord, requests" >nul 2>&1 || python -m pip install -r requirements.txt
:loop
python -u bot.py
echo [!!] Bot stopped. Restarting in 5s... (Ctrl+C to quit)
timeout /t 5 /nobreak >nul
goto loop
