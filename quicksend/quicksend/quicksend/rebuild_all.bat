@echo off
echo Starting Full Rebuild...

REM Cleanup
if exist "dist\QuickSend" rmdir /s /q "dist\QuickSend"
if exist "build" rmdir /s /q "build"

REM 64-bit Build
echo [1/4] Building 64-bit...
set "PATH=C:\Users\Administrator\AppData\Local\Programs\Python\Python313;C:\Users\Administrator\AppData\Local\Programs\Python\Python313\Scripts;%SystemRoot%\system32;%SystemRoot%;%SystemRoot%\System32\Wbem"

python -m PyInstaller --noconfirm --clean --noconsole --onedir --name "QuickSend" --add-data "static\dist;static\dist" --add-data "static\fonts;static\fonts" --add-data "static\index.build.html;static" --add-data "static\script.js;static" --hidden-import=flask --hidden-import=werkzeug --hidden-import=jinja2 --hidden-import=click --hidden-import=itsdangerous --hidden-import=markupsafe --hidden-import=webview --hidden-import=clr_loader --hidden-import=pythonnet --hidden-import=jaraco.text --collect-all flask --collect-all werkzeug --collect-all clr_loader --collect-all pythonnet --collect-datas jaraco.text --icon=logo.ico app.py

if %errorlevel% neq 0 (
    echo 64-bit Build Failed!
    exit /b 1
)

echo Copying missing assets manually...
if exist "dist\QuickSend\_internal" (
    xcopy /s /e /y "static\dist" "dist\QuickSend\_internal\static\dist\"
) else (
    xcopy /s /e /y "static\dist" "dist\QuickSend\static\dist\"
)

if exist "logo.ico" (
    echo Copying logo.ico to dist...
    copy /Y "logo.ico" "dist\QuickSend\" >nul
)

echo Copying DLLs (64-bit)...
if not exist "dist\QuickSend\_internal" mkdir "dist\QuickSend\_internal"
copy /y "%SystemRoot%\System32\vcruntime140.dll" "dist\QuickSend\_internal\"
copy /y "%SystemRoot%\System32\vcruntime140_1.dll" "dist\QuickSend\_internal\"
copy /y "%SystemRoot%\System32\msvcp140.dll" "dist\QuickSend\_internal\"
copy /y "%SystemRoot%\System32\msvcp140_1.dll" "dist\QuickSend\_internal\"
copy /y "%SystemRoot%\System32\msvcp140_2.dll" "dist\QuickSend\_internal\"
copy /y "%SystemRoot%\System32\msvcp140_codecvt_ids.dll" "dist\QuickSend\_internal\"
copy /y "%SystemRoot%\System32\concrt140.dll" "dist\QuickSend\_internal\"
copy /y "%SystemRoot%\System32\vccorlib140.dll" "dist\QuickSend\_internal\"

echo Building 64-bit Installer...
set "NSIS_PATH=makensis"
if exist "D:\NSIS\makensis.exe" set "NSIS_PATH=D:\NSIS\makensis.exe"
if exist "D:\NSIS\Bin\makensis.exe" set "NSIS_PATH=D:\NSIS\Bin\makensis.exe"
if exist "C:\Program Files (x86)\NSIS\makensis.exe" set "NSIS_PATH=C:\Program Files (x86)\NSIS\makensis.exe"
"%NSIS_PATH%" /INPUTCHARSET UTF8 ..\installer\QuickSend.nsi

REM 32-bit Build
echo [2/4] Building 32-bit...
REM Reset PATH to avoid Python 3.13 interference
set "PATH=%SystemRoot%\system32;%SystemRoot%;%SystemRoot%\System32\Wbem;C:\Windows\System32\WindowsPowerShell\v1.0\"

call build_x86.bat

echo Done.
