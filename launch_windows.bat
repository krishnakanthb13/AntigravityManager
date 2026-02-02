@echo off
TITLE Antigravity Manager Launcher
SETLOCAL EnableDelayedExpansion

echo ==========================================
echo       Antigravity Manager Launcher
echo ==========================================
echo.

:: 1. Check for Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

:: 2. Check for npm
where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] npm is not installed or not in PATH.
    pause
    exit /b 1
)

:: 3. Check for node_modules
if not exist "node_modules\" (
    echo [INFO] node_modules not found. Running npm install...
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
)

:: 4. Start the application
echo [INFO] Starting Antigravity Manager...
call npm start

if %ERRORLEVEL% neq 0 (
    echo.
    echo [INFO] Application exited with code %ERRORLEVEL%.
    pause
)

ENDLOCAL
