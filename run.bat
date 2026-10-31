@echo off
setlocal enabledelayedexpansion

title HELIOXEN AI — Desktop Assistant Launcher

:: Navigate to script directory (handling spaces in path)
cd /d "%~dp0"

echo =====================================================================
echo                 HELIOXEN AI — DESKTOP LAUNCHER
echo =====================================================================
echo.

:: 1. Verify Node.js is installed and in PATH
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js was not detected in your PATH.
    echo Please install Node.js (v20+ or v22+ LTS recommended) from:
    echo   https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: 2. Verify npm is available
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] npm package manager was not detected in your PATH.
    echo Please ensure Node.js and npm are properly added to system PATH.
    echo.
    pause
    exit /b 1
)

:: 3. Check for dependencies (node_modules)
if not exist "node_modules" (
    echo [INFO] node_modules not found. Installing project dependencies...
    call npm.cmd install
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] npm install encountered an error.
        echo Please check your internet connection or install logs.
        echo.
        pause
        exit /b %errorlevel%
    )
    echo [INFO] Dependencies installed successfully.
    echo.
)

:: 4. Launch Electron Vite Development Mode
echo [INFO] Launching HELIOXEN AI in development mode...
echo [INFO] Vite dev server and Electron desktop window will start.
echo [INFO] Press Ctrl+C in this window to stop the application.
echo.

call npm.cmd run dev

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Application terminated with exit code %errorlevel%.
    pause
)
