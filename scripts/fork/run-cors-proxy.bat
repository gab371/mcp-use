@echo off
setlocal

rem Root directory of the repository
set "ROOT_DIR=%~dp0..\.."

echo ========================================================
echo  🚀 Starting Local MCP CORS Proxy (Windows)
echo ========================================================

rem Usage:
rem   run-cors-proxy.bat             (default port: 3020)
rem   run-cors-proxy.bat 3050        (custom port via argument)
rem   run-cors-proxy.bat --port 3050 (custom port via flag)
rem   set PORT=3050 ^&^& run-cors-proxy.bat

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found in PATH. Please install Node.js: https://nodejs.org/
    pause
    exit /b 1
)

node "%ROOT_DIR%\scripts\fork\cors-proxy.mjs" %*
