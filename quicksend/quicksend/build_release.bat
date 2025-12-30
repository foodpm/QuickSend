@echo off
chcp 65001 >nul
echo ==========================================
echo QuickSend - Full Release Build Script
echo Version 1.0.1
echo ==========================================

set BASE_DIR=%~dp0
set STATIC_DIR=%BASE_DIR%quicksend\static
set APP_DIR=%BASE_DIR%quicksend
set INSTALLER_DIR=%BASE_DIR%installer

:: Save original PATH
set "ORIG_PATH=%PATH%"

:: 1. Frontend Build
echo.
echo [1/3] Building Frontend (React/Vite)...
echo Skipping Frontend Build (Node.js not found or manual skip)...
:: cd /d "%STATIC_DIR%"
:: if not exist node_modules (
::    echo Installing frontend dependencies...
::    call npm install
::    if %errorlevel% neq 0 goto :error
:: )
:: echo Running npm build...
:: call npm run build
:: if %errorlevel% neq 0 goto :error

:: 2. Backend Build & Installer (64-bit)
echo.
echo [2/4] Building 64-bit Version...
cd /d "%APP_DIR%"
echo Current Dir: %CD%

:: Add 64-bit Python to PATH
set "PATH=C:\Users\Administrator\AppData\Local\Programs\Python\Python313;C:\Users\Administrator\AppData\Local\Programs\Python\Python313\Scripts;%PATH%"

call build.bat
if %errorlevel% neq 0 goto :error

:: 3. Backend Build & Installer (32-bit)
echo.
echo [3/4] Building 32-bit Version...
:: Restore PATH for 32-bit build to avoid Python 3.13 conflict
set "PATH=%ORIG_PATH%"
call build_x86.bat
if %errorlevel% neq 0 goto :error

:: Move installers to the correct directory
echo.
echo Moving installers to installer directory...
if exist "installer\*.exe" move /Y "installer\*.exe" "..\installer\"
if exist "..\installer\*.exe" echo Installers are in ..\installer\

echo.
echo ==========================================
echo BUILD SUCCESSFUL!
echo 64-bit Installer: ..\installer\QuickSend-Setup-1.0.1-win64.exe
echo 32-bit Installer: ..\installer\QuickSend-Setup-1.0.1-win32.exe
echo ==========================================
exit /b 0

:error
echo.
echo ==========================================
echo BUILD FAILED
echo ==========================================
exit /b 1
