#!/usr/bin/env bash
set -e
NAME=QuickSend

# Check if maclogo.png exists in parent directory and copy it
if [ -f "../maclogo.png" ]; then
  echo "Found maclogo.png in parent directory, copying to logo2_.png"
  cp "../maclogo.png" logo2_.png
fi

if [ -f requirements.txt ]; then
  python3 -m pip install -q -r requirements.txt
fi
python3 -m pip install -q PyInstaller
if [ ! -f "maclogo.icns" ] && [ ! -f "logo2_.icns" ] && [ -d "assets/icon.iconset" ]; then
  echo "Generating logo2_.icns from assets/icon.iconset..."
  iconutil -c icns assets/icon.iconset -o logo2_.icns || true
fi

if [ ! -f "maclogo.icns" ] && [ -f "logo2_.png" ] && [ ! -f "logo2_.icns" ]; then
  mkdir -p assets/icon.iconset
  sips -z 16 16 logo2_.png --out assets/icon.iconset/icon_16x16.png >/dev/null
  sips -z 32 32 logo2_.png --out assets/icon.iconset/icon_16x16@2x.png >/dev/null
  sips -z 32 32 logo2_.png --out assets/icon.iconset/icon_32x32.png >/dev/null
  sips -z 64 64 logo2_.png --out assets/icon.iconset/icon_32x32@2x.png >/dev/null
  sips -z 128 128 logo2_.png --out assets/icon.iconset/icon_128x128.png >/dev/null
  sips -z 256 256 logo2_.png --out assets/icon.iconset/icon_128x128@2x.png >/dev/null
  sips -z 256 256 logo2_.png --out assets/icon.iconset/icon_256x256.png >/dev/null
  sips -z 512 512 logo2_.png --out assets/icon.iconset/icon_256x256@2x.png >/dev/null
  sips -z 512 512 logo2_.png --out assets/icon.iconset/icon_512x512.png >/dev/null
  sips -z 1024 1024 logo2_.png --out assets/icon.iconset/icon_512x512@2x.png >/dev/null
  iconutil -c icns assets/icon.iconset -o logo2_.icns >/dev/null || true
fi
ICON_OPT=""
if [ -f maclogo.icns ]; then
  ICON_OPT="--icon=maclogo.icns"
elif [ -f logo2_.icns ]; then
  ICON_OPT="--icon=logo2_.icns"
elif [ -f assets/logo.icns ]; then
  ICON_OPT="--icon=assets/logo.icns"
fi
python3 -m PyInstaller --noconfirm --clean --windowed --onedir --name "$NAME" --osx-bundle-identifier com.quicksend.app \
  --add-data "static/dist:static/dist" \
  --add-data "static/fonts:static/fonts" \
  --add-data "static/index.build.html:static" \
  --add-data "static/index.html:static" \
  --add-data "static/script.js:static" \
  --add-data "static/favicon.ico:static" \
  --add-data "static/favicon.png:static" \
  --hidden-import werkzeug.security \
  $ICON_OPT app.py

mkdir -p dist
DMG_JSON="dist/dmg.json"
DMG_ICON=""
if [ -f maclogo.icns ]; then
  DMG_ICON="maclogo.icns"
  cp -f maclogo.icns "dist/maclogo.icns"
elif [ -f logo2_.icns ]; then
  DMG_ICON="logo2_.icns"
  cp -f logo2_.icns "dist/logo2_.icns"
fi

cat > "$DMG_JSON" <<EOF
{
  "title": "$NAME",
  "icon": "$DMG_ICON",
  "contents": [
    { "x": 448, "y": 344, "type": "link", "path": "/Applications" },
    { "x": 192, "y": 344, "type": "file", "path": "${NAME}.app" }
  ]
}
EOF

if [ -z "$DMG_ICON" ]; then
  # macOS sed requires empty string for extension
  sed -i '' '/"icon":/d' "$DMG_JSON"
fi

rm -f "dist/${NAME}-mac.dmg"
echo "Building DMG with appdmg..."
if command -v npx >/dev/null 2>&1; then
    npx appdmg "$DMG_JSON" "dist/${NAME}-mac.dmg"
else
    echo "npx not found, falling back to hdiutil..."
    DMG_TMP="$(mktemp -d)"
    trap 'rm -rf "$DMG_TMP"' EXIT
    ditto "dist/${NAME}.app" "$DMG_TMP/${NAME}.app"
    ln -s /Applications "$DMG_TMP/Applications" || true

    for attempt in 1 2 3 4 5; do
      if hdiutil create -volname "$NAME" -srcfolder "$DMG_TMP" -ov -format UDZO "dist/${NAME}-mac.dmg"; then
        break
      fi
      sleep $((attempt * 3))
    done

    if [ ! -f "dist/${NAME}-mac.dmg" ]; then
      exit 1
    fi
fi
rm -f "$DMG_JSON" || true
echo "DMG: dist/$NAME-mac.dmg"
