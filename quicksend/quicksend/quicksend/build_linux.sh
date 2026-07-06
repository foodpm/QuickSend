#!/usr/bin/env bash
set -e
NAME=QuickSend

echo "=========================================="
echo "QuickSend - Linux AppImage Build Script"
echo "=========================================="

# 1. Install dependencies
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
  # Convert to required sizes for AppDir
  mkdir -p assets/icon.iconset
  python3 -c "
from PIL import Image
img = Image.open('$ICON_SRC')
for s in [16, 32, 64, 128, 256, 512]:
    resized = img.resize((s, s), Image.LANCZOS)
    name = f'icon_{s}x{s}.png'
    resized.save(f'assets/icon.iconset/{name}')
"
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

# 5. Create AppDir structure for AppImage
echo "Creating AppDir..."
APPDIR="dist/$NAME.AppDir"
mkdir -p "$APPDIR/usr/bin"
mkdir -p "$APPDIR/usr/share/applications"
mkdir -p "$APPDIR/usr/share/icons/hicolor/256x256/apps"

# Copy PyInstaller output
cp -r "dist/$NAME" "$APPDIR/usr/bin/$NAME"

# Create AppRun entry point
cat > "$APPDIR/AppRun" <<'EOF'
#!/bin/bash
HERE="$(dirname "$(readlink -f "$0")")"
exec "$HERE/usr/bin/QuickSend/QuickSend" "$@"
EOF
chmod +x "$APPDIR/AppRun"

# Copy desktop file and icon
cp "QuickSend.desktop" "$APPDIR/"
cp "QuickSend.desktop" "$APPDIR/usr/share/applications/"

if [ -n "$ICON_SRC" ]; then
  cp "$ICON_SRC" "$APPDIR/QuickSend.png"
  cp "$ICON_SRC" "$APPDIR/usr/share/icons/hicolor/256x256/apps/QuickSend.png"
fi

# 6. Download and run appimagetool
echo "Creating AppImage..."
ARCH_SUFFIX="${ARCH_SUFFIX:-x86_64}"
APPIMAGETOOL="appimagetool-${ARCH_SUFFIX}.AppImage"

if [ ! -f "$APPIMAGETOOL" ]; then
  if [ "$ARCH_SUFFIX" = "aarch64" ]; then
    APPIMAGE_URL="https://github.com/AppImage/AppImageKit/releases/download/continuous/appimagetool-aarch64.AppImage"
  else
    APPIMAGE_URL="https://github.com/AppImage/AppImageKit/releases/download/continuous/appimagetool-x86_64.AppImage"
  fi
  echo "Downloading appimagetool from $APPIMAGE_URL..."
  wget -q "$APPIMAGE_URL" -O "$APPIMAGETOOL"
  chmod +x "$APPIMAGETOOL"
fi

# Extract appimagetool (no FUSE needed in CI)
if [ ! -d "appimagetool-extracted" ]; then
  ./"$APPIMAGETOOL" --appimage-extract >/dev/null 2>&1
  mv squashfs-root appimagetool-extracted
fi

OUTPUT_APPIMAGE="dist/${NAME}-linux-${ARCH_SUFFIX}.AppImage"
ARCH="$ARCH_SUFFIX" ./appimagetool-extracted/AppRun "$APPDIR" "$OUTPUT_APPIMAGE"

echo "=========================================="
echo "AppImage created: $OUTPUT_APPIMAGE"
echo "=========================================="
