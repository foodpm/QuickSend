$url = "https://downloads.sourceforge.net/project/nsis/NSIS%203/3.08/nsis-3.08-setup.exe"
$out = "nsis-setup.exe"
Write-Host "Downloading NSIS from $url..."
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing
    Write-Host "Download complete. Installing..."
    Start-Process -FilePath $out -ArgumentList "/S" -Wait
    Write-Host "Installation complete."
} catch {
    Write-Host "Error: $_"
    exit 1
}
