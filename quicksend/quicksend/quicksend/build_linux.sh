#!/usr/bin/env bash
set -e
NAME=QuickSend

echo "=========================================="
echo "QuickSend - Linux AppImage Build Script"
echo "=========================================="

# 1. Install dependencies (if not already installed)
if [ -f requirements.txt ]; then
  python3 -m pip install -q -r requirements.txt
fi
python3 -m pip install -q PyInstaller

# 2. Icon handling - use logo2.png or logo.png
ICON_SRC=""
if [ -f "logo2.png" ]; then
  ICON_SRC="logo2.png"
elif [ -f "logo.png" ]; then
  ICON_SRC="logo.png"
fi

if [ -n "$ICON_SRC" ]; then
  echo "Using icon: $ICON_SRC"
  python3 -c "
from PIL import Image
img = Image.open('$ICON_SRC')
for s in [16, 32, 64, 128, 256, 512]:
    resized = img.resize((s, s), Image.LANCZOS)
    resized.save(f'assets/icon.iconset/icon_{s}x{s}.png')
" 2>/dev/null || true
fi

# 3. Analytics config
ANALYTICS_DATA_OPT=""
if [ -n "${SUPABASE_URL:-}" ] && [ -n "${SUPABASE_ANON_KEY:-}" ]; then
  cat > analytics_config.json <<EOF
{"supabase_url":"${SUPABASE_URL}","supabase_anon_key":"${SUPABASE_ANON_KEY}"}
EOF
  ANALYTICS_DATA_OPT='--add-data "analytics_config.json:."'
fi

# 4. Build with PyInstaller
echo "Running PyInstaller..."
python3 -m PyInstaller --noconfirm --clean --onedir --name "$NAME" \
  --static-libpython \
  $ANALYTICS_DATA_OPT \
  --add-data "static/dist:static/dist" \
  --add-data "static/fonts:static/fonts" \
  --add-data "static/index.build.html:static" \
  --add-data "static/index.html:static" \
  --add-data "static/script.js:static" \
  --add-data "static/favicon.ico:static" \
  --add-data "static/favicon.png:static" \
  --collect-all flask \
  --collect-all werkzeug \
  --collect-all certifi \
  --hidden-import werkzeug.security \
  app.py

rm -f analytics_config.json || true

# 5. Create AppDir structure
echo "Creating AppDir..."
APPDIR="dist/$NAME.AppDir"
mkdir -p "$APPDIR/usr/bin"
mkdir -p "$APPDIR/usr/share/applications"
mkdir -p "$APPDIR/usr/share/icons/hicolor/256x256/apps"

# Copy PyInstaller output
cp -r "dist/$NAME" "$APPDIR/usr/bin/$NAME"

# Create AppRun entry point
cat > "$APPDIR/AppRun" <<'APPRUN'
#!/bin/bash
HERE="$(dirname "$(readlink -f "$0")")"
exec "$HERE/usr/bin/QuickSend/QuickSend" "$@"
APPRUN
chmod +x "$APPDIR/AppRun"

# Copy desktop file and icon
cp "QuickSend.desktop" "$APPDIR/"
cp "QuickSend.desktop" "$APPDIR/usr/share/applications/"

if [ -n "$ICON_SRC" ]; then
  cp "$ICON_SRC" "$APPDIR/QuickSend.png"
  cp "$ICON_SRC" "$APPDIR/usr/share/icons/hicolor/256x256/apps/QuickSend.png"
fi

# 6. Build AppImage manually (no appimagetool AppImage dependency)
echo "Building AppImage manually..."
ARCH_SUFFIX="${ARCH_SUFFIX:-x86_64}"

# Determine runtime URL based on architecture
if [ "$ARCH_SUFFIX" = "aarch64" ]; then
  RUNTIME_URL="https://github.com/AppImage/AppImageKit/releases/download/continuous/runtime-aarch64"
else
  RUNTIME_URL="https://github.com/AppImage/AppImageKit/releases/download/continuous/runtime-x86_64"
fi

# Download AppImage runtime
RUNTIME_FILE="dist/runtime-${ARCH_SUFFIX}"
if [ ! -f "$RUNTIME_FILE" ]; then
  echo "Downloading AppImage runtime from $RUNTIME_URL..."
  wget -q "$RUNTIME_URL" -O "$RUNTIME_FILE"
  chmod +x "$RUNTIME_FILE"
fi

# Ensure squashfs-tools is available
if ! command -v mksquashfs &>/dev/null; then
  echo "Installing squashfs-tools..."
  sudo apt-get update -qq && sudo apt-get install -y -qq squashfs-tools
fi

# Verify mksquashfs is available
if ! command -v mksquashfs &>/dev/null; then
  echo "ERROR: mksquashfs not found. Cannot create AppImage."
  exit 1
fi

# Create squashfs from AppDir
SQUASHFS_FILE="dist/${NAME}-${ARCH_SUFFIX}.squashfs"
OUTPUT_APPIMAGE="dist/${NAME}-linux-${ARCH_SUFFIX}.AppImage"

mksquashfs "$APPDIR" "$SQUASHFS_FILE" -noappend -comp gzip -quiet

# Concatenate runtime + squashfs to create AppImage
cat "$RUNTIME_FILE" "$SQUASHFS_FILE" > "$OUTPUT_APPIMAGE"
chmod +x "$OUTPUT_APPIMAGE"

# Clean up temporary files
rm -f "$SQUASHFS_FILE"

echo "=========================================="
echo "AppImage created: $OUTPUT_APPIMAGE"
echo "Size: $(du -h "$OUTPUT_APPIMAGE" | cut -f1)"
echo "=========================================="
