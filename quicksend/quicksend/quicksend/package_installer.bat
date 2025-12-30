@echo off
chcp 65001 >nul
echo ==========================================
echo QuickSend - Package Installer Script
echo ==========================================

echo [1/2] Checking for NSIS (makensis.exe)...

set "NSIS_PATH="

if exist "D:\nsis\makensis.exe" (
    set "NSIS_PATH=D:\nsis\makensis.exe"
) else if exist "C:\Program Files (x86)\NSIS\makensis.exe" (
    set "NSIS_PATH=C:\Program Files (x86)\NSIS\makensis.exe"
) else if exist "C:\Program Files\NSIS\makensis.exe" (
    set "NSIS_PATH=C:\Program Files\NSIS\makensis.exe"
) else (
    where makensis >nul 2>&1
    if %errorlevel%==0 (
        set "NSIS_PATH=makensis"
    )
)

if "%NSIS_PATH%"=="" (
    echo Error: NSIS compiler (makensis.exe) not found.
    echo Please install NSIS from https://nsis.sourceforge.io/Download
    echo or make sure it is in your PATH.
    echo.
    pause
    exit /b 1
)

echo Found NSIS at: %NSIS_PATH%

echo [2/2] Compiling installer script...
"%NSIS_PATH%" /INPUTCHARSET UTF8 installer.nsi

if %errorlevel% neq 0 (
    echo.
    echo Error: Failed to compile installer.
    pause
    exit /b %errorlevel%
)

echo.
echo Success! Installer created in dist folder.
echo File: dist\QuickSend_Setup_v6.0.exe
pause
