@echo off
chcp 65001 >nul
echo ==========================================
echo QuickSend - Build Script
echo ==========================================

echo [0/4] Checking Python version...
python --version

echo.
echo NOTE: For best compatibility, Python 3.11 is recommended.
echo If build fails with Python 3.13, please install Python 3.11.
echo.

echo [1/4] Installing dependencies...
pip install --upgrade pip
pip install flask pyinstaller>=6.0 werkzeug pywebview pythonnet clr_loader jaraco.text
IF EXIST logo2.png (
  echo Converting logo2.png to logo.ico...
  pip install pillow >nul 2>&1
  python -c "from PIL import Image; img=Image.open('logo2.png'); sizes=[(256,256),(128,128),(64,64),(32,32),(16,16)]; img.save('logo.ico', sizes=sizes)" 2>nul
) ELSE IF EXIST logo.png (
  echo Converting logo.png to logo.ico...
  pip install pillow >nul 2>&1
  python -c "from PIL import Image; img=Image.open('logo.png'); sizes=[(256,256),(128,128),(64,64),(32,32),(16,16)]; img.save('logo.ico', sizes=sizes)" 2>nul
)
if %errorlevel% neq 0 (
    echo Failed to install dependencies. Please ensure Python and pip are installed and in your PATH.
rem pause
    exit /b %errorlevel%
)

echo [2/4] Building executable...
if exist dist\QuickSend rmdir /s /q dist\QuickSend
echo Updating index.build.html from dist...
copy /Y "static\dist\index.html" "static\index.build.html" >nul
echo This may take a minute...
set NAME=QuickSend
IF EXIST logo.ico (
  pyinstaller --noconfirm --clean --noconsole --onedir --name "%NAME%" --add-data "static\\dist;static\\dist" --add-data "static\\fonts;static\\fonts" --add-data "static\\index.build.html;static" --add-data "static\\script.js;static" --hidden-import=flask --hidden-import=werkzeug --hidden-import=jinja2 --hidden-import=click --hidden-import=itsdangerous --hidden-import=markupsafe --hidden-import=webview --hidden-import=clr_loader --hidden-import=pythonnet --hidden-import=jaraco.text --collect-all flask --collect-all werkzeug --collect-all clr_loader --collect-all pythonnet --collect-datas jaraco.text --icon=logo.ico app.py
) ELSE (
  pyinstaller --noconfirm --clean --noconsole --onedir --name "%NAME%" --add-data "static\\dist;static\\dist" --add-data "static\\fonts;static\\fonts" --add-data "static\\index.build.html;static" --add-data "static\\script.js;static" --hidden-import=flask --hidden-import=werkzeug --hidden-import=jinja2 --hidden-import=click --hidden-import=itsdangerous --hidden-import=markupsafe --hidden-import=webview --hidden-import=clr_loader --hidden-import=pythonnet --hidden-import=jaraco.text --collect-all flask --collect-all werkzeug --collect-all clr_loader --collect-all pythonnet --collect-datas jaraco.text app.py
)

echo Copying missing assets manually...
if exist "dist\%NAME%\_internal" (
    xcopy /s /e /y "static\dist" "dist\%NAME%\_internal\static\dist\"
) else (
    xcopy /s /e /y "static\dist" "dist\%NAME%\static\dist\"
)

if exist "logo.ico" (
    echo Copying logo.ico to dist...
    copy /Y "logo.ico" "dist\%NAME%\" >nul
)

if %errorlevel% neq 0 (
    echo Build failed!
rem pause
    exit /b %errorlevel%
)

echo [3/4] Build complete!
echo The executable is located in the 'dist' folder.
echo You can now run "dist\%NAME%\%NAME%.exe"

echo [4/4] Downloading VC++ Redistributable (x64) for installer robustness...
set VCREDIST_URL=https://aka.ms/vs/17/release/vc_redist.x64.exe
set VCREDIST_PATH=dist\vc_redist.x64.exe
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $u='%VCREDIST_URL%'; $p='%VCREDIST_PATH%'; if (!(Test-Path $p)) { Invoke-WebRequest -Uri $u -OutFile $p -UseBasicParsing } } catch { Write-Host 'Skip VC++ download: ' $_.Exception.Message }"

set "NSIS_PATH="
if exist "D:\NSIS\makensis.exe" set "NSIS_PATH=D:\NSIS\makensis.exe"
if exist "D:\nsis\makensis.exe" set "NSIS_PATH=D:\nsis\makensis.exe"
if exist "C:\Program Files (x86)\NSIS\makensis.exe" set "NSIS_PATH=C:\Program Files (x86)\NSIS\makensis.exe"
if exist "C:\Program Files\NSIS\makensis.exe" set "NSIS_PATH=C:\Program Files\NSIS\makensis.exe"

if "%NSIS_PATH%"=="" (
  where makensis >nul 2>&1
  if %errorlevel%==0 (
    set "NSIS_PATH=makensis"
  ) else (
    echo NSIS not found. Attempting to install via winget...
    winget install NSIS.NSIS --silent --accept-source-agreements --accept-package-agreements
    if %errorlevel%==0 (
       echo NSIS installed successfully.
       if exist "C:\Program Files (x86)\NSIS\makensis.exe" (
         set "NSIS_PATH=C:\Program Files (x86)\NSIS\makensis.exe"
       ) else (
         set "NSIS_PATH=makensis"
       )
    ) else (
       echo Failed to install NSIS automatically. Please install NSIS manually from https://nsis.sourceforge.io/Download
       echo and run: makensis /INPUTCHARSET UTF8 ..\installer\QuickSend.nsi
       exit /b 1
    )
  )
)

echo Building installer with %NSIS_PATH% ...

:: Manual DLL copy to ensure VCRuntime is present (fix for missing DLL error)
echo Copying VCRuntime DLLs...
if exist "dist\QuickSend\_internal" (
    echo Copying DLLs to _internal...
    copy /y "%SystemRoot%\System32\vcruntime140.dll" "dist\QuickSend\_internal\" >nul
    copy /y "%SystemRoot%\System32\vcruntime140_1.dll" "dist\QuickSend\_internal\" >nul
    copy /y "%SystemRoot%\System32\msvcp140.dll" "dist\QuickSend\_internal\" >nul
    copy /y "%SystemRoot%\System32\msvcp140_1.dll" "dist\QuickSend\_internal\" >nul
    copy /y "%SystemRoot%\System32\msvcp140_2.dll" "dist\QuickSend\_internal\" >nul
    copy /y "%SystemRoot%\System32\msvcp140_codecvt_ids.dll" "dist\QuickSend\_internal\" >nul
    copy /y "%SystemRoot%\System32\concrt140.dll" "dist\QuickSend\_internal\" >nul
    copy /y "%SystemRoot%\System32\vccorlib140.dll" "dist\QuickSend\_internal\" >nul
)

copy /y "%SystemRoot%\System32\vcruntime140.dll" dist\QuickSend\ >nul
copy /y "%SystemRoot%\System32\vcruntime140_1.dll" dist\QuickSend\ >nul
copy /y "%SystemRoot%\System32\msvcp140.dll" dist\QuickSend\ >nul
copy /y "%SystemRoot%\System32\msvcp140_1.dll" dist\QuickSend\ >nul
copy /y "%SystemRoot%\System32\msvcp140_2.dll" dist\QuickSend\ >nul
copy /y "%SystemRoot%\System32\msvcp140_codecvt_ids.dll" dist\QuickSend\ >nul
copy /y "%SystemRoot%\System32\concrt140.dll" dist\QuickSend\ >nul
copy /y "%SystemRoot%\System32\vccorlib140.dll" dist\QuickSend\ >nul

"%NSIS_PATH%" /INPUTCHARSET UTF8 ..\..\installer\QuickSend.nsi

if %errorlevel% neq 0 (
    echo NSIS build failed!
    exit /b %errorlevel%
)

exit /b 0
