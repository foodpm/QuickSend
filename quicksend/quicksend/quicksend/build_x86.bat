@echo off
chcp 65001 >nul
echo ==========================================
echo QuickSend - Build x86 (32-bit) Version
echo ==========================================
echo.
echo Note: To build a 32-bit executable, you MUST have a 32-bit Python installed.
echo.

set "PYTHON_X86="

REM Check for common locations
if exist "C:\Python38\python.exe" set "PYTHON_X86=C:\Python38\python.exe"
if exist "C:\Python311-32\python.exe" set "PYTHON_X86=C:\Python311-32\python.exe"
if exist "C:\Python310-32\python.exe" set "PYTHON_X86=C:\Python310-32\python.exe"
if exist "C:\Python39-32\python.exe" set "PYTHON_X86=C:\Python39-32\python.exe"
if exist "C:\Program Files (x86)\Python311-32\python.exe" set "PYTHON_X86=C:\Program Files (x86)\Python311-32\python.exe"

if "%PYTHON_X86%"=="" (
    echo No 32-bit Python found in common locations.
    echo Please enter the full path to your 32-bit python.exe:
    set /p PYTHON_X86=Path: 
)

if not exist "%PYTHON_X86%" (
    echo Error: Python executable not found at: %PYTHON_X86%
    rem pause
    exit /b 1
)

echo.
echo Using Python: %PYTHON_X86%
echo Checking architecture...
"%PYTHON_X86%" -c "import struct; print('Architecture: ' + str(struct.calcsize('P') * 8) + '-bit')"

echo.
echo [1/4] Installing dependencies...
"%PYTHON_X86%" -m pip install --upgrade pip
"%PYTHON_X86%" -m pip install flask pyinstaller>=6.0 werkzeug pywebview pillow jaraco.text

echo.
echo [2/4] Building executable...
if exist dist\QuickSend rmdir /s /q dist\QuickSend
echo Updating index.build.html from dist...
copy /Y "static\dist\index.html" "static\index.build.html" >nul

set NAME=QuickSend
IF EXIST logo.ico (
  "%PYTHON_X86%" -m PyInstaller --noconfirm --clean --noconsole --onedir --name "%NAME%" --add-data "static\\dist;static\\dist" --add-data "static\\fonts;static\\fonts" --add-data "static\\index.build.html;static" --add-data "static\\script.js;static" --hidden-import=flask --hidden-import=werkzeug --hidden-import=jinja2 --hidden-import=click --hidden-import=itsdangerous --hidden-import=markupsafe --hidden-import=webview --hidden-import=jaraco.text --collect-all flask --collect-all werkzeug --collect-datas jaraco.text --collect-all platformdirs --icon=logo.ico app.py
) ELSE (
  "%PYTHON_X86%" -m PyInstaller --noconfirm --clean --noconsole --onedir --name "%NAME%" --add-data "static\\dist;static\\dist" --add-data "static\\fonts;static\\fonts" --add-data "static\\index.build.html;static" --add-data "static\\script.js;static" --hidden-import=flask --hidden-import=werkzeug --hidden-import=jinja2 --hidden-import=click --hidden-import=itsdangerous --hidden-import=markupsafe --hidden-import=webview --hidden-import=jaraco.text --collect-all flask --collect-all werkzeug --collect-datas jaraco.text --collect-all platformdirs app.py
)

if %errorlevel% neq 0 (
    echo Build failed!
    rem pause
    exit /b %errorlevel%
)

echo.
echo [3/4] Downloading VC++ Redistributable (x86)...
set VCREDIST_URL=https://aka.ms/vs/17/release/vc_redist.x86.exe
set VCREDIST_PATH=dist\QuickSend\vc_redist.x86.exe
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $u='%VCREDIST_URL%'; $p='%VCREDIST_PATH%'; Invoke-WebRequest -Uri $u -OutFile $p -UseBasicParsing } catch { Write-Host 'Download failed: ' $_.Exception.Message }"

echo.
echo [4/4] Packaging installer...

set "NSIS_PATH="
if exist "D:\NSIS\makensis.exe" (
    set "NSIS_PATH=D:\NSIS\makensis.exe"
) else if exist "D:\nsis\makensis.exe" (
    set "NSIS_PATH=D:\nsis\makensis.exe"
) else if exist "C:\Program Files (x86)\NSIS\makensis.exe" (
    set "NSIS_PATH=C:\Program Files (x86)\NSIS\makensis.exe"
) else if exist "C:\Program Files\NSIS\makensis.exe" (
    set "NSIS_PATH=C:\Program Files\NSIS\makensis.exe"
) else (
    where makensis >nul 2>&1
    if %errorlevel%==0 set "NSIS_PATH=makensis"
)

if "%NSIS_PATH%"=="" (
    echo Error: NSIS not found.
    rem pause
    exit /b 1
)

:: Manual DLL copy to ensure VCRuntime is present (fix for missing DLL error)
echo Copying VCRuntime DLLs (x86)...
if exist "dist\QuickSend\_internal" (
    echo Copying DLLs to _internal...
    copy /y "%SystemRoot%\SysWOW64\vcruntime140.dll" "dist\QuickSend\_internal\" >nul
    copy /y "%SystemRoot%\SysWOW64\vcruntime140_1.dll" "dist\QuickSend\_internal\" >nul
    copy /y "%SystemRoot%\SysWOW64\msvcp140.dll" "dist\QuickSend\_internal\" >nul
    copy /y "%SystemRoot%\SysWOW64\msvcp140_1.dll" "dist\QuickSend\_internal\" >nul
    copy /y "%SystemRoot%\SysWOW64\concrt140.dll" "dist\QuickSend\_internal\" >nul
    copy /y "%SystemRoot%\SysWOW64\vccorlib140.dll" "dist\QuickSend\_internal\" >nul
)

copy /y "%SystemRoot%\SysWOW64\vcruntime140.dll" dist\QuickSend\ >nul
copy /y "%SystemRoot%\SysWOW64\vcruntime140_1.dll" dist\QuickSend\ >nul
copy /y "%SystemRoot%\SysWOW64\msvcp140.dll" dist\QuickSend\ >nul
copy /y "%SystemRoot%\SysWOW64\msvcp140_1.dll" dist\QuickSend\ >nul
copy /y "%SystemRoot%\SysWOW64\concrt140.dll" dist\QuickSend\ >nul
copy /y "%SystemRoot%\SysWOW64\vccorlib140.dll" dist\QuickSend\ >nul

"%NSIS_PATH%" /INPUTCHARSET UTF8 ..\..\installer\installer_x86.nsi

if %errorlevel% neq 0 (
    echo Installer packaging failed!
    rem pause
    exit /b 1
)

echo.
echo Success! x86 Installer created at: dist\QuickSend_Setup_x86_v6.0.exe
rem pause
