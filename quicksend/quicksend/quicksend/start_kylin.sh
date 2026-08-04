#!/usr/bin/env bash
# ==========================================
# QuickSend - 银河麒麟 / 龙芯 LoongArch64 启动脚本
#
# 运行模式（自动选择）：
#   1. 原生窗口模式（默认）：检测到 pywebview + GTK(gi) 时，弹出独立应用窗口
#   2. 浏览器模式（兜底）：无图形组件时以 HEADLESS 启动并自动打开默认浏览器
#   用法：
#     ./start_kylin.sh                 # 自动选择（优先原生窗口）
#     ./start_kylin.sh --headless      # 强制浏览器模式
#     PORT=8000 ./start_kylin.sh       # 自定义端口（浏览器模式生效）
# ==========================================
set -u

cd "$(dirname "$0")"

# ---------- 1. 检测 Python ----------
PYTHON=""
for p in python3 python; do
  if command -v "$p" >/dev/null 2>&1; then
    PYTHON="$p"
    break
  fi
done
if [ -z "$PYTHON" ]; then
  echo "[错误] 未找到 python3，请先安装 Python 3.8 以上版本。"
  echo "       银河麒麟 V10 (LoongArch64) 建议安装 Python 3.11，参见部署文档。"
  exit 1
fi
echo "使用 Python: $($PYTHON --version 2>&1)"

# ---------- 2. 安装/检查核心依赖 ----------
if ! $PYTHON -c "import flask, werkzeug, certifi" >/dev/null 2>&1; then
  echo "[提示] 正在安装依赖 (flask / werkzeug / certifi)..."
  $PYTHON -m pip install flask werkzeug certifi \
    || $PYTHON -m pip install --break-system-packages flask werkzeug certifi \
    || { echo "[错误] 依赖安装失败，请检查网络或改用 pip3。"; exit 1; }
fi

# ---------- 3. Pillow：优先系统包，其次 pip ----------
if ! $PYTHON -c "import PIL" >/dev/null 2>&1; then
  echo "[提示] 正在安装 Pillow（图片预览/生成二维码所需）..."
  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get install -y python3-pil >/dev/null 2>&1 \
      && echo "已通过系统包安装 Pillow" \
      || $PYTHON -m pip install Pillow >/dev/null 2>&1 \
      || echo "[警告] Pillow 安装失败，图片相关功能将不可用"
  else
    $PYTHON -m pip install Pillow >/dev/null 2>&1 \
      || echo "[警告] Pillow 安装失败，图片相关功能将不可用"
  fi
fi

# ---------- 4. 选择运行模式 ----------
HEADLESS_MODE=""
for arg in "$@"; do
  case "$arg" in
    --headless|--browser) HEADLESS_MODE=1 ;;
  esac
done

if [ -z "$HEADLESS_MODE" ]; then
  # 探测原生窗口支持：pywebview + PyGObject(gi)
  if $PYTHON -c "import webview" >/dev/null 2>&1 && $PYTHON -c "import gi" >/dev/null 2>&1; then
    echo "[模式] 检测到原生窗口支持（pywebview + GTK），将以独立窗口启动"
    HEADLESS_MODE=0
  else
    echo "[模式] 未检测到 pywebview/GTK，将使用浏览器模式"
    echo "      （如需原生窗口：sudo apt-get install -y python3-gi gir1.2-webkit2-4.0 && pip3 install pywebview）"
    HEADLESS_MODE=1
  fi
fi

PORT="${PORT:-5000}"
export PORT

# ---------- 5. 启动 ----------
if [ "$HEADLESS_MODE" = "1" ]; then
  # 浏览器模式：HEADLESS 服务 + 自动打开浏览器
  export HEADLESS=1
  echo "=========================================="
  echo " QuickSend 正在启动（浏览器模式），请稍候..."
  echo " 本机访问:   http://127.0.0.1:${PORT}"
  IP=$(hostname -I 2>/dev/null | awk '{print $1}')
  if [ -n "${IP:-}" ]; then
    echo " 局域网访问: http://${IP}:${PORT}"
  fi
  echo " 退出: 按 Ctrl+C 或关闭本窗口"
  echo "=========================================="

  $PYTHON app.py &
  APP_PID=$!

  # 等端口就绪后自动打开浏览器
  for i in $(seq 1 15); do
    if curl -s "http://127.0.0.1:${PORT}" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
  sleep 1

  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "http://127.0.0.1:${PORT}" >/dev/null 2>&1 &
  elif command -v gio >/dev/null 2>&1; then
    gio open "http://127.0.0.1:${PORT}" >/dev/null 2>&1 &
  else
    echo " [提示] 请在浏览器中手动打开: http://127.0.0.1:${PORT}"
  fi
else
  # 原生窗口模式：不设 HEADLESS，app.py 会创建独立窗口；
  # 若窗口初始化失败，app.py 已内置回退浏览器逻辑
  echo "=========================================="
  echo " QuickSend 正在启动（原生窗口模式）..."
  echo " 关闭窗口即退出；如需强制浏览器模式：./start_kylin.sh --headless"
  echo "=========================================="
  $PYTHON app.py
  echo "QuickSend 已退出"
  exit 0
fi

# ---------- 6. 优雅退出（浏览器模式） ----------
trap "kill $APP_PID 2>/dev/null; echo ''; echo 'QuickSend 已退出'; exit 0" INT TERM
wait $APP_PID
