@echo off
chcp 65001 >nul
echo ==========================================
echo QuickSend - Package Installer Script
echo ==========================================

echo [1/2] Checking for NSIS (makensis.exe)...

set "NSIS_PATH="

if exist "D:\NSIS\makensis.exe" (
    set "NSIS_PATH=D:\NSIS\makensis.exe"
) else if exist "D:\NSIS\Bin\makensis.exe" (
    set "NSIS_PATH=D:\NSIS\Bin\makensis.exe"
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
"%NSIS_PATH%" /INPUTCHARSET UTF8 ..\..\installer\QuickSend.nsi

if %errorlevel% neq 0 (
    echo.
    echo Error: Failed to compile installer.
    pause
    exit /b %errorlevel%
)

"%NSIS_PATH%" /INPUTCHARSET UTF8 ..\..\installer\installer_x86.nsi

if %errorlevel% neq 0 (
    echo.
    echo Error: Failed to compile installer.
    pause
    exit /b %errorlevel%
)

echo.
echo Success! Installers created in ..\..\installer folder.
echo 64-bit: ..\..\installer\QuickSend-Setup-1.0.7-win64.exe
echo 32-bit: ..\..\installer\QuickSend-Setup-1.0.7-win32.exe
pause
