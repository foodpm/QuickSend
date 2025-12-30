param(
  [string]$ExePath = "dist\\QuickSend.exe"
)
$ErrorActionPreference = 'Stop'
if (!(Test-Path $ExePath)) {
  python -m pip install --upgrade pyinstaller | Out-Null
  pyinstaller --noconfirm --clean --noconsole --onefile --name QuickSend --add-data "quicksend\\static;static" quicksend\\app.py | Out-Null
}
$nsis1 = "D:\\NSIS\\makensis.exe"
$nsis2 = "D:\\NSIS\\Bin\\makensis.exe"
if (Test-Path $nsis1) { & $nsis1 "/DEXE_PATH=$ExePath" "installer\\QuickSend.nsi" }
elseif (Test-Path $nsis2) { & $nsis2 "/DEXE_PATH=$ExePath" "installer\\QuickSend.nsi" }
else { throw "NSIS not found at D:\\NSIS" }
