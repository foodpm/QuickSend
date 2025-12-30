icon 制作（macOS .icns）

步骤：
- 准备一张方形 PNG（建议 1024x1024），命名为 `logo.png`。
- 创建图标集合目录：`mkdir -p assets/icon.iconset`。
- 生成各尺寸图：
  - `sips -z 16 16 logo.png --out assets/icon.iconset/icon_16x16.png`
  - `sips -z 32 32 logo.png --out assets/icon.iconset/icon_16x16@2x.png`
  - `sips -z 32 32 logo.png --out assets/icon.iconset/icon_32x32.png`
  - `sips -z 64 64 logo.png --out assets/icon.iconset/icon_32x32@2x.png`
  - `sips -z 128 128 logo.png --out assets/icon.iconset/icon_128x128.png`
  - `sips -z 256 256 logo.png --out assets/icon.iconset/icon_128x128@2x.png`
  - `sips -z 256 256 logo.png --out assets/icon.iconset/icon_256x256.png`
  - `sips -z 512 512 logo.png --out assets/icon.iconset/icon_256x256@2x.png`
  - `sips -z 512 512 logo.png --out assets/icon.iconset/icon_512x512.png`
  - `sips -z 1024 1024 logo.png --out assets/icon.iconset/icon_512x512@2x.png`
- 生成 icns：`iconutil -c icns assets/icon.iconset -o assets/logo.icns`。

生成后，`build_mac.sh` 会自动使用 `assets/logo.icns`。
