@echo off
echo ========================================================
echo Start building Docker images...
echo NOTE: Ensure Docker Desktop is running.
echo ========================================================

:: 1. Build Native/AMD64 version (Standard PC/Server)
echo.
echo [1/3] Building x86_64/AMD64 image (Standard PC)...
docker build --platform linux/amd64 -t quicksend:amd64 .
if %errorlevel% neq 0 (
    echo Build AMD64 failed!
    pause
    exit /b %errorlevel%
)
echo Saving AMD64 image to quicksend_amd64.tar...
docker save -o quicksend_amd64.tar quicksend:amd64

:: 2. Build ARM64 version (NAS/Mac M1/Raspberry Pi)
echo.
echo [2/3] Building ARM64 image (NAS/Mobile)...
docker build --platform linux/arm64 -t quicksend:arm64 .
if %errorlevel% neq 0 (
    echo Build ARM64 failed!
    pause
    exit /b %errorlevel%
)
echo Saving ARM64 image to quicksend_arm64.tar...
docker save -o quicksend_arm64.tar quicksend:arm64

:: 3. Try to build x86 32-bit version (Experimental)
:: Note: Node.js official images often drop 32-bit support, this might fail.
echo.
echo [3/3] Attempting to build x86 32-bit image (Experimental)...
docker build --platform linux/386 -t quicksend:x86 .
if %errorlevel% neq 0 (
    echo x86 32-bit build failed or not supported by base images. Skipping.
) else (
    echo Saving x86 32-bit image to quicksend_x86.tar...
    docker save -o quicksend_x86.tar quicksend:x86
)

echo.
echo ========================================================
echo All builds completed!
echo You can upload the .tar files to your target machine and load them using:
echo docker load -i filename.tar
echo ========================================================
pause
