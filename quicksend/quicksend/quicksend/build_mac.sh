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
if [ ! -f "logo2_.icns" ] && [ -d "assets/icon.iconset" ]; then
  echo "Generating logo2_.icns from assets/icon.iconset..."
  iconutil -c icns assets/icon.iconset -o logo2_.icns || true
fi

if [ -f "logo2_.png" ] && [ ! -f "logo2_.icns" ]; then
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
if [ -f logo2_.icns ]; then
  ICON_OPT="--icon=logo2_.icns"
elif [ -f assets/logo.icns ]; then
  ICON_OPT="--icon=assets/logo.icns"
fi
python3 -m PyInstaller --clean --windowed --onedir --name "$NAME" --osx-bundle-identifier com.quicksend.app \
  --add-data "static/dist:static/dist" \
  --add-data "static/fonts:static/fonts" \
  --add-data "static/index.build.html:static" \
  --add-data "static/index.html:static" \
  --add-data "static/script.js:static" \
  --add-data "static/favicon.ico:static" \
  --add-data "static/favicon.png:static" \
  --hidden-import werkzeug.security \
  $ICON_OPT app.py
# Create dmg.json
cat > dmg.json <<EOF
{
  "title": "$NAME",
  "icon": "logo2_.icns",
  "contents": [
    { "x": 448, "y": 344, "type": "link", "path": "/Applications" },
    { "x": 192, "y": 344, "type": "file", "path": "dist/${NAME}.app" }
  ]
}
EOF

# Check if icon exists, if not, remove icon line from json
if [ ! -f "logo2_.icns" ]; then
  # macOS sed requires empty string for extension
  sed -i '' '/"icon":/d' dmg.json
fi

rm -f "dist/${NAME}-mac.dmg"
echo "Building DMG with appdmg..."
if command -v npx >/dev/null 2>&1; then
    npx appdmg dmg.json "dist/${NAME}-mac.dmg"
else
    echo "npx not found, falling back to hdiutil..."
    DMG_TMP="dist/${NAME}-dmg"
    rm -rf "$DMG_TMP"
    mkdir -p "$DMG_TMP"
    cp -R "dist/${NAME}.app" "$DMG_TMP/"
    ln -s /Applications "$DMG_TMP/Applications" || true
    hdiutil create -volname "$NAME" -srcfolder "$DMG_TMP" -ov -format UDZO "dist/${NAME}-mac.dmg"
    rm -rf "$DMG_TMP"
fi
echo "DMG: dist/$NAME-mac.dmg"
