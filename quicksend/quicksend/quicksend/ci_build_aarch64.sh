#!/bin/bash
set -e

echo "=========================================="
echo "QuickSend - AArch64 Docker CI Build Script"
echo "=========================================="
echo "Base: Debian 10 (glibc 2.28) + Portable Python 3.11"

# Install system dependencies for ARM Debian 10
apt-get update -qq
apt-get install -y -qq --no-install-recommends \
    ca-certificates \
    curl \
    wget \
    squashfs-tools \
    file \
    libgtk-3-dev \
    libwebkit2gtk-4.0-dev \
    libappindicator3-dev \
    gcc \
    g++ \
    make \
    libc6-dev \
    zlib1g-dev \
    libffi-dev \
    libssl-dev \
    pkg-config

# Download portable Python 3.11 for aarch64
# python-build-standalone builds on Debian 9 (glibc 2.24+) and are compatible with glibc 2.28
# Try the latest release first, fall back to older releases
PYTHON_INSTALLED=0
for RELEASE_TAG in "20260623" "20250807" "20250723" "20250409"; do
    if [ "$PYTHON_INSTALLED" = "1" ]; then break; fi
    for PY_MINOR in 11; do
        for PY_PATCH in $(seq 15 -1 0); do
            if [ "$PYTHON_INSTALLED" = "1" ]; then break; fi
            PYTHON_VERSION="3.${PY_MINOR}.${PY_PATCH}"
            FILENAME="cpython-${PYTHON_VERSION}+${RELEASE_TAG}-aarch64-unknown-linux-gnu-install_only_stripped.tar.gz"
            URL="https://github.com/astral-sh/python-build-standalone/releases/download/${RELEASE_TAG}/${FILENAME}"
            echo "Trying: $URL"
            if curl -L --fail --silent --show-error -o /tmp/python.tar.gz "$URL" 2>/dev/null; then
                echo "Downloaded Python ${PYTHON_VERSION} (release ${RELEASE_TAG})"
                tar -xzf /tmp/python.tar.gz -C /usr/local
                rm -f /tmp/python.tar.gz
                PYTHON_INSTALLED=1
                break
            fi
        done
    done
done

if [ "$PYTHON_INSTALLED" != "1" ]; then
    echo "ERROR: Failed to download portable Python 3.11 for aarch64"
    exit 1
fi

# Verify Python
export PATH="/usr/local/bin:${PATH}"
echo "Python version: $(python3 --version)"
echo "Python location: $(which python3)"

# Upgrade pip and install build dependencies
python3 -m pip install --upgrade pip setuptools wheel

# Install all Python dependencies from requirements.txt
cd /workspace
cp -f requirements.txt /tmp/requirements.txt
python3 -m pip install -r /tmp/requirements.txt
python3 -m pip install pyinstaller

# Create analytics config if SUPABASE secrets are available
if [ -n "${SUPABASE_ANON_KEY:-}" ]; then
    SUPABASE_URL_VAL="${SUPABASE_URL:-}"
    if [ -z "$SUPABASE_URL_VAL" ] && [ -n "${SUPABASE_PROJECT_REF:-}" ]; then
        SUPABASE_URL_VAL="https://${SUPABASE_PROJECT_REF}.supabase.co"
    fi
    if [ -n "$SUPABASE_URL_VAL" ]; then
        printf '{"supabase_url":"%s","supabase_anon_key":"%s"}' "$SUPABASE_URL_VAL" "$SUPABASE_ANON_KEY" > analytics_config.json
        echo "Created analytics_config.json"
    fi
fi

# Build the AppImage
echo "Building AppImage..."
export ARCH_SUFFIX=aarch64
bash build_linux.sh

echo "=========================================="
echo "AArch64 Docker build complete!"
ls -la dist/*.AppImage
echo "=========================================="
