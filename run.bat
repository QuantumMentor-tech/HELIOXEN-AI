@echo off
setlocal enabledelayedexpansion

:: Set UTF-8 code page for clean character display
chcp 65001 >nul

title HELIOXEN AI -- Desktop Command Center and Voice Assistant Launcher

:: Navigate to script directory (handles paths with spaces)
cd /d "%~dp0"

cls
echo ===============================================================================
echo            HELIOXEN AI -- INTELLIGENT DESKTOP COMMAND LAYER
echo                  Phase 7: Real-Time Voice and AI Assistant
echo ===============================================================================
echo.

:: 1. Verify Node.js is installed
where node >nul 2>nul
if errorlevel 1 goto :NO_NODE

:: 2. Verify npm is available
where npm >nul 2>nul
if errorlevel 1 goto :NO_NPM

:: Display detected versions
for /f "tokens=*" %%v in ('node -v 2^>nul') do set "NODE_VER=%%v"
for /f "tokens=*" %%v in ('npm -v 2^>nul') do set "NPM_VER=%%v"
echo [OK] Runtime Environment: Node.js %NODE_VER% ^| npm %NPM_VER%

:: 3. Check and install dependencies if node_modules is missing
if not exist "node_modules\" (
    echo.
    echo [INFO] First-time setup detected: 'node_modules' is missing.
    echo [INFO] Installing required project dependencies via npm.cmd install...
    echo.
    call npm.cmd install
    if errorlevel 1 goto :INSTALL_FAILED
    echo.
    echo [OK] Dependencies installed successfully.
)

echo.
echo Select an action [Auto-launching in 5 seconds...]:
echo   [1] Launch HELIOXEN AI Desktop App [Development Mode with HMR]
echo   [2] Run Automated Test Suite [Vitest - 133 Unit/Integration Tests]
echo   [3] Run TypeScript Typecheck [Node and Web validation]
echo   [4] Build Production Application Bundle [electron-vite build]
echo   [5] Clean Reinstall Dependencies [npm clean install]
echo   [6] Exit Launcher
echo.

choice /c 123456 /t 5 /d 1 /m "Enter your choice [1-6]: "
set "CHOICE_VAL=%errorlevel%"

if "%CHOICE_VAL%"=="1" goto :RUN_DEV
if "%CHOICE_VAL%"=="2" goto :RUN_TESTS
if "%CHOICE_VAL%"=="3" goto :RUN_TYPECHECK
if "%CHOICE_VAL%"=="4" goto :RUN_BUILD
if "%CHOICE_VAL%"=="5" goto :REINSTALL
if "%CHOICE_VAL%"=="6" goto :EXIT

:RUN_DEV
echo.
echo ===============================================================================
echo [INFO] Starting HELIOXEN AI Desktop Assistant [electron-vite dev]...
echo [INFO] The Electron window and Three.js Central AI Core will open shortly.
echo [INFO] Press Ctrl+C in this console window to terminate the application.
echo ===============================================================================
echo.
call npm.cmd run dev
goto :FINISH

:RUN_TESTS
echo.
echo ===============================================================================
echo [INFO] Running Vitest Automated Test Suite...
echo ===============================================================================
echo.
call npm.cmd test
goto :FINISH

:RUN_TYPECHECK
echo.
echo ===============================================================================
echo [INFO] Running TypeScript Typecheck [Node processes and Web renderer]...
echo ===============================================================================
echo.
call npm.cmd run typecheck:node
if errorlevel 1 goto :FINISH
call npm.cmd run typecheck:web
goto :FINISH

:RUN_BUILD
echo.
echo ===============================================================================
echo [INFO] Compiling production bundles [Main, Preload, and Renderer]...
echo ===============================================================================
echo.
call npm.cmd run build
goto :FINISH

:REINSTALL
echo.
echo ===============================================================================
echo [INFO] Reinstalling dependencies cleanly...
echo ===============================================================================
echo.
call npm.cmd install
goto :FINISH

:NO_NODE
echo [ERROR] Node.js is NOT detected on your system.
echo.
echo To run HELIOXEN AI, you need to download and install Node.js:
echo   1. Visit: https://nodejs.org/
echo   2. Download the LTS version [v20.x, v22.x, or v24.x recommended]
echo   3. During installation, ensure 'Add to PATH' is checked
echo   4. Restart your terminal or this script after installing
echo.
pause
exit /b 1

:NO_NPM
echo [ERROR] npm package manager was not found in PATH.
echo Please ensure Node.js was installed with npm enabled in PATH.
echo.
pause
exit /b 1

:INSTALL_FAILED
echo.
echo [ERROR] Dependency installation failed.
echo Please check your internet connection and verify write permissions.
echo.
pause
exit /b 1

:FINISH
if errorlevel 1 (
    echo.
    echo [NOTICE] Process ended with exit code %errorlevel%.
) else (
    echo.
    echo [OK] Task completed successfully.
)
echo.
pause
exit /b 0

:EXIT
exit /b 0
