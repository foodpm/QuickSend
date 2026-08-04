#!/usr/bin/env bash
# ==========================================
# QuickSend - 银河麒麟（龙芯 LoongArch64）.deb 安装包构建脚本
#
# 用法：在麒麟龙芯机器上，进入本脚本所在目录（含 app.py / static）后运行：
#     ./build_loongarch64_deb.sh
#
# 产物：build/quicksend_<版本>_<架构>.deb
# 用户拿到 .deb 后，双击即可安装（图形安装器）或 sudo dpkg -i 安装
# ==========================================
set -e
cd "$(dirname "$0")"

VERSION="1.0.19"
PACKAGE="quicksend"
ARCH="loong64"
PKG_ROOT="build/pkg_quicksend"
OUT_DEB="build/quicksend_${VERSION}_${ARCH}.deb"

# ---------- 1. 前置检查 ----------
command -v dpkg-deb >/dev/null 2>&1 || { echo "[错误] 未找到 dpkg-deb（请在有 dpkg-deb 的麒麟/Debian 系统上构建）"; exit 1; }
[ -f "app.py" ] && [ -d "static" ] || { echo "[错误] 请在本脚本所在目录（含 app.py / static）运行"; exit 1; }

# ---------- 2. 清理并创建目录结构 ----------
echo "创建打包目录..."
rm -rf "$PKG_ROOT" build/*.deb 2>/dev/null || true
mkdir -p "$PKG_ROOT/DEBIAN"
mkdir -p "$PKG_ROOT/opt/quicksend"
mkdir -p "$PKG_ROOT/usr/share/applications"
mkdir -p "$PKG_ROOT/usr/share/icons/hicolor/256x256/apps"
mkdir -p "$PKG_ROOT/usr/bin"

# ---------- 3. 复制应用文件 ----------
echo "复制应用文件..."
cp app.py static requirements.txt start_kylin.sh logo.png "$PKG_ROOT/opt/quicksend/"
[ -f analytics.py ] && cp analytics.py "$PKG_ROOT/opt/quicksend/" || true
[ -f logo.ico ] && cp logo.ico "$PKG_ROOT/opt/quicksend/" || true
chmod +x "$PKG_ROOT/opt/quicksend/start_kylin.sh"

# ---------- 4. 桌面快捷方式 ----------
cat > "$PKG_ROOT/usr/share/applications/quicksend.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=QuickSend
GenericName=LAN Sharing
Comment=局域网文件与文字快速分享
Exec=/opt/quicksend/start_kylin.sh
Icon=/opt/quicksend/logo.png
Terminal=true
Categories=Network;Utility;
EOF
cp "$PKG_ROOT/usr/share/applications/quicksend.desktop" "$PKG_ROOT/usr/share/icons/hicolor/256x256/apps/" 2>/dev/null || true

# ---------- 5. control 控制文件 ----------
cat > "$PKG_ROOT/DEBIAN/control" <<EOF
Package: ${PACKAGE}
Version: ${VERSION}
Section: net
Priority: optional
Architecture: ${ARCH}
Maintainer: QuickSend Team <support@quicksend.chat>
Depends: python3 (>= 3.8)
Description: QuickSend - LAN file & text sharing tool
  Fast, private LAN file & text sharing between your computer,
  phone and other devices over the local network.
  No cloud, no account. Optimized for LoongArch64 / Kylin OS.
EOF

# ---------- 6. postinst：自动补依赖 + 尝试原生窗口 ----------
cat > "$PKG_ROOT/DEBIAN/postinst" <<'EOF'
#!/bin/bash
set -e
APP_DIR="/opt/quicksend"

echo "QuickSend 正在配置运行环境..."

# 核心依赖（flask / werkzeug / certifi）
python3 -m pip install flask werkzeug certifi >/dev/null 2>&1 \
  || python3 -m pip install --break-system-packages flask werkzeug certifi >/dev/null 2>&1 \
  || echo "[提示] Python 依赖自动安装失败，首次启动时 start_kylin.sh 会再次尝试。"

# Pillow：优先系统包，其次 pip
python3 -c "import PIL" >/dev/null 2>&1 || {
  apt-get install -y python3-pil >/dev/null 2>&1 \
    || python3 -m pip install Pillow >/dev/null 2>&1 \
    || python3 -m pip install --break-system-packages Pillow >/dev/null 2>&1 \
    || echo "[提示] Pillow 未安装，图片相关功能受限。"
}

# 原生窗口支持（可选）：python3-gi + WebKitGTK + pywebview
# 装不上不影响使用，应用会自动回退到浏览器模式
if ! python3 -c "import webview" >/dev/null 2>&1; then
  if apt-get install -y python3-gi gir1.2-webkit2-4.0 >/dev/null 2>&1; then
    python3 -m pip install pywebview >/dev/null 2>&1 \
      || python3 -m pip install --break-system-packages pywebview >/dev/null 2>&1 \
      || echo "[提示] pywebview 安装失败，将使用浏览器模式"
  else
    echo "[提示] 系统无 WebKitGTK 图形组件，将使用浏览器模式"
  fi
fi

chmod +x "$APP_DIR/start_kylin.sh"
echo "QuickSend 配置完成，可从桌面图标启动。"
exit 0
EOF
chmod 755 "$PKG_ROOT/DEBIAN/postinst"

# ---------- 7. /usr/bin/quicksend 命令入口 ----------
ln -sf /opt/quicksend/start_kylin.sh "$PKG_ROOT/usr/bin/quicksend"

# ---------- 8. 构建 deb ----------
echo "构建 ${OUT_DEB} ..."
mkdir -p build
dpkg-deb --build --root-owner-group "$PKG_ROOT" "$OUT_DEB"
rm -rf "$PKG_ROOT"

echo "=========================================="
echo " 成功！安装包已生成：$(pwd)/${OUT_DEB}"
echo " 在麒麟系统上双击该 .deb 即可安装"
echo "=========================================="
