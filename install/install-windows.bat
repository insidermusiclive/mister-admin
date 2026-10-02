@echo off
REM Double-click this file on Windows to install Mister Admin into your Cloudflare account.
cd /d "%~dp0\.."
where node >nul 2>nul
if %errorlevel% neq 0 (
  echo Node.js is not installed. Download it from https://nodejs.org ^(LTS^), install it, then double-click this file again.
  pause
  exit /b 1
)
node install\install.mjs
