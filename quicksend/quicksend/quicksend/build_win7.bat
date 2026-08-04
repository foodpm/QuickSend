@echo off
chcp 65001 >nul
echo ==========================================
echo QuickSend - Build Windows 7 (x64) Version
echo ==========================================
echo.
echo 注意：Win7 兼容构建必须使用 64 位 Python 3.9 + PyInstaller 5.13.x
echo       （Python 3.10+ 和 PyInstaller 6.x 均不支持 Windows 7）
echo.

set "PYTHON_WIN7="
if exist "C:\Python39\python.exe" set "PYTHON_WIN7=C:\Python39\python.exe"
if exist "C:\Program Files\Python39\python.exe" set "PYTHON_WIN7=C:\Program Files\Python39\python.exe"
if exist "%LOCALAPPDATA%\Programs\Python\Python39\python.exe" set "PYTHON_WIN7=%LOCALAPPDATA%\Programs\Python\Python39\python.exe"
if exist "%USERPROFILE%\AppData\Local\Programs\Python\Python39\python.exe" set "PYTHON_WIN7=%USERPROFILE%\AppData\Local\Programs\Python\Python39\python.exe"

if "%PYTHON_WIN7%"=="" (
    echo 未找到 64 位 Python 3.9，请先安装：
    echo   https://www.python.org/downloads/release/python-3913/
    echo 安装时务必勾选 "Add Python to PATH"。
    echo 也可以修改本脚本开头的 PYTHON_WIN7 变量指向你的 Python 3.9 路径。
    exit /b 1
)

echo 使用 Python: %PYTHON_WIN7%
"%PYTHON_WIN7%" -c "import struct; assert struct.calcsize('P')*8==64, '需要 64 位 Python'; print('架构校验: 64-bit OK')"
if %errorlevel% neq 0 (
    echo 错误：请使用 64 位 Python 3.9 构建 Win7 x64 版本。
    exit /b 1
)

echo.
echo [1/5] 安装依赖（Win7 兼容锁定）...
"%PYTHON_WIN7%" -m pip install --upgrade pip
"%PYTHON_WIN7%" -m pip install -r requirements-win7.txt
if %errorlevel% neq 0 (
    echo 依赖安装失败！
    exit /b 1
)

echo.
echo [2/5] 构建可执行文件...
if exist dist\QuickSend rmdir /s /q dist\QuickSend
echo 更新 index.build.html 前端产物...
copy /Y "static\dist\index.html" "static\index.build.html" >nul

set NAME=QuickSend
set "ANALYTICS_DATA_OPT="
if not "%SUPABASE_URL%"=="" if not "%SUPABASE_ANON_KEY%"=="" (
  echo 嵌入 analytics_config.json...
  > analytics_config.json (
    echo {
    echo   "supabase_url": "%SUPABASE_URL%",
    echo   "supabase_anon_key": "%SUPABASE_ANON_KEY%"
    echo }
  )
  set "ANALYTICS_DATA_OPT=--add-data \"analytics_config.json;.\""
)

IF EXIST logo.ico (
  "%PYTHON_WIN7%" -m PyInstaller --noconfirm --clean --noconsole --onedir --name "%NAME%" %ANALYTICS_DATA_OPT% --add-data "static\\dist;static\\dist" --add-data "static\\fonts;static\\fonts" --add-data "static\\index.build.html;static" --add-data "static\\script.js;static" --hidden-import=flask --hidden-import=werkzeug --hidden-import=jinja2 --hidden-import=click --hidden-import=itsdangerous --hidden-import=markupsafe --collect-all flask --collect-all werkzeug --collect-all certifi --icon=logo.ico app.py
) ELSE (
  "%PYTHON_WIN7%" -m PyInstaller --noconfirm --clean --noconsole --onedir --name "%NAME%" %ANALYTICS_DATA_OPT% --add-data "static\\dist;static\\dist" --add-data "static\\fonts;static\\fonts" --add-data "static\\index.build.html;static" --add-data "static\\script.js;static" --hidden-import=flask --hidden-import=werkzeug --hidden-import=jinja2 --hidden-import=click --hidden-import=itsdangerous --hidden-import=markupsafe --collect-all flask --collect-all werkzeug --collect-all certifi app.py
)
if exist analytics_config.json del /q analytics_config.json

if %errorlevel% neq 0 (
    echo 构建失败！
    exit /b 1
)

echo 复制前端资源到产物目录...
if exist "dist\%NAME%\_internal" (
    xcopy /s /e /y "static\dist" "dist\%NAME%\_internal\static\dist\" >nul
) else (
    xcopy /s /e /y "static\dist" "dist\%NAME%\static\dist\" >nul
)
if exist "logo.ico" (
    copy /Y "logo.ico" "dist\%NAME%\" >nul
)

echo.
echo [3/5] 拷贝 VC++ 运行库（Win7 常缺 vcruntime140 系列）...
if exist "dist\QuickSend\_internal" (
    copy /y "%SystemRoot%\System32\vcruntime140.dll" "dist\QuickSend\_internal\" >nul 2>&1
    copy /y "%SystemRoot%\System32\vcruntime140_1.dll" "dist\QuickSend\_internal\" >nul 2>&1
    copy /y "%SystemRoot%\System32\msvcp140.dll" "dist\QuickSend\_internal\" >nul 2>&1
    copy /y "%SystemRoot%\System32\msvcp140_1.dll" "dist\QuickSend\_internal\" >nul 2>&1
    copy /y "%SystemRoot%\System32\concrt140.dll" "dist\QuickSend\_internal\" >nul 2>&1
    copy /y "%SystemRoot%\System32\vccorlib140.dll" "dist\QuickSend\_internal\" >nul 2>&1
)
copy /y "%SystemRoot%\System32\vcruntime140.dll" dist\QuickSend\ >nul 2>&1
copy /y "%SystemRoot%\System32\vcruntime140_1.dll" dist\QuickSend\ >nul 2>&1
copy /y "%SystemRoot%\System32\msvcp140.dll" dist\QuickSend\ >nul 2>&1
copy /y "%SystemRoot%\System32\msvcp140_1.dll" dist\QuickSend\ >nul 2>&1
copy /y "%SystemRoot%\System32\concrt140.dll" dist\QuickSend\ >nul 2>&1
copy /y "%SystemRoot%\System32\vccorlib140.dll" dist\QuickSend\ >nul 2>&1

echo.
echo [4/5] 下载 VC++ Redistributable (x64) 供安装器附带...
set VCREDIST_URL=https://aka.ms/vs/17/release/vc_redist.x64.exe
set VCREDIST_PATH=dist\vc_redist.x64.exe
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $u='%VCREDIST_URL%'; $p='%VCREDIST_PATH%'; if (!(Test-Path $p)) { Invoke-WebRequest -Uri $u -OutFile $p -UseBasicParsing } } catch { Write-Host '跳过 VC++ 下载: ' $_.Exception.Message }"

echo.
echo [5/5] 打包安装器...
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
    echo 未找到 NSIS，请安装后手动执行：
    echo   makensis /INPUTCHARSET UTF8 ..\..\installer\QuickSend_win7.nsi
    exit /b 1
  )
)

"%NSIS_PATH%" /INPUTCHARSET UTF8 ..\..\installer\QuickSend_win7.nsi
if %errorlevel% neq 0 (
    echo NSIS 打包失败！
    exit /b 1
)

echo.
echo 成功！Win7 (x64) 安装包已生成：..\..\installer\QuickSend-Setup-1.0.19-win7-64.exe
echo 提示：Win7 版本采用"默认浏览器打开"模式（不含 pywebview 原生窗口）。
pause
exit /b 0
