#!/bin/bash
set -e

echo "=========================================="
echo "QuickSend - AArch64 Docker CI Build Script"
echo "=========================================="
echo "Base: arm64v8/python:3.11-buster (glibc 2.28)"

# Fix Debian 10 EOL apt sources
sed -i 's/deb.debian.org/archive.debian.org/g' /etc/apt/sources.list 2>/dev/null || true
sed -i 's/security.debian.org/archive.debian.org/g' /etc/apt/sources.list 2>/dev/null || true
sed -i 's|http://archive|https://archive|g' /etc/apt/sources.list 2>/dev/null || true

# Install system dependencies
apt-get update -qq
apt-get install -y -qq --no-install-recommends \
    squashfs-tools \
    file \
    wget

# Upgrade pip
python3 -m pip install --upgrade pip setuptools wheel

# Install Python dependencies
cd /workspace
python3 -m pip install -r requirements.txt
python3 -m pip install pyinstaller

# Copy static/index.html for build
if [ -f "static/dist/index.html" ]; then
    cp static/dist/index.html static/index.build.html
fi

# Build the AppImage
echo "Building AppImage..."
export ARCH_SUFFIX=aarch64
bash build_linux.sh

echo "=========================================="
echo "AArch64 Docker build complete!"
ls -la dist/*.AppImage
echo "=========================================="
