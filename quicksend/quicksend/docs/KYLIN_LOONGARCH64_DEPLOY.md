# QuickSend 银河麒麟（龙芯 LoongArch64）部署指南

本指南适用于在 **银河麒麟桌面操作系统 V10 (SP1)**、**龙芯 loongson-3A6000（LoongArch64 指令集）** 上运行 QuickSend。

## 方案说明

QuickSend 在麒麟（LoongArch64）下支持 **原生窗口优先、浏览器兜底** 两种运行模式，自动选择：

- **原生窗口模式（首选）**：系统提供 python3-gi + WebKitGTK（`gir1.2-webkit2-4.0`）时，弹出独立应用窗口，体验与 Windows 版一致
- **浏览器模式（兜底）**：缺少图形组件时，以 `HEADLESS` 方式运行并自动打开默认浏览器
- 代码已内置「原生窗口初始化失败自动回退浏览器」逻辑，无需用户干预

## 一、环境要求

| 项目 | 要求 |
| --- | --- |
| 操作系统 | 银河麒麟桌面操作系统 V10 (SP1) |
| CPU | 龙芯 loongson-3A6000（LoongArch64） |
| Python | 3.8 及以上（推荐 3.11，CPython 自 3.11 起官方支持 loongarch64） |
| 浏览器 | 麒麟系统自带浏览器（兜底模式使用） |

## 二、安装 Python

### 方式 A：使用系统自带 Python

检查系统 Python 版本：

```bash
python3 --version
```

若版本 ≥ 3.8 可直接进入下一步。

### 方式 B：安装 Python 3.11（推荐）

若系统 Python 过低，可使用龙芯平台提供的 Python 3.11：

```bash
# 通过源码编译（CPython 3.11 官方支持 loongarch64）
wget https://www.python.org/ftp/python/3.11.9/Python-3.11.9.tgz
tar xzf Python-3.11.9.tgz
cd Python-3.11.9
./configure --enable-optimizations
make -j$(nproc)
sudo make altinstall
```

> 也可从龙芯开放社区（www.loongnix.cn）或麒麟软件商店获取预编译的 Python 3.11 安装包。

## 三、一键安装包（.deb，推荐）

适合交付给终端用户，安装方式与普通软件一致（双击即可）。

### 构建安装包（维护者 / IT 在龙芯机器上执行）

```bash
cd QuickSend/quicksend/quicksend/quicksend
chmod +x build_loongarch64_deb.sh
./build_loongarch64_deb.sh
```

生成 `build/quicksend_1.0.19_loong64.deb`。

### 用户安装

- **图形化**：双击 `.deb` → 麒麟软件安装器 → 点「安装」→ 输入密码
- **命令行**：`sudo dpkg -i quicksend_1.0.19_loong64.deb`

安装过程自动完成：

1. 程序装到 `/opt/quicksend`，生成桌面 QuickSend 图标和 `/usr/bin/quicksend` 命令
2. 自动安装 Python 依赖（flask / werkzeug / certifi）与 Pillow 图片库
3. 自动尝试安装原生窗口组件（python3-gi + WebKitGTK + pywebview），装不上会自动回退浏览器模式

### 卸载

软件管理器找到 QuickSend 卸载，或 `sudo dpkg -r quicksend`。

## 四、获取代码（源码方式）

```bash
git clone https://github.com/foodpm/QuickSend.git
cd QuickSend/quicksend/quicksend/quicksend
```

> 仓库深层目录结构说明：`QuickSend/quicksend/quicksend/quicksend/` 为应用源码根目录（含 `app.py`、`static/`、`start_kylin.sh`）。

## 五、一键启动（推荐）

```bash
./start_kylin.sh
```

脚本会自动完成：

1. 检测 Python 并安装依赖（flask / werkzeug / certifi）
2. Pillow 优先使用系统包（`sudo apt-get install -y python3-pil`），失败则用 pip 安装
3. 自动选择运行模式：检测到 pywebview + GTK 则弹出**独立窗口**；否则以浏览器模式启动并自动打开页面

常用参数：

```bash
./start_kylin.sh              # 自动选择（优先原生窗口）
./start_kylin.sh --headless   # 强制浏览器模式
PORT=8000 ./start_kylin.sh    # 自定义端口（浏览器模式生效）
```

## 六、手动运行

```bash
# 安装依赖
python3 -m pip install flask werkzeug certifi

# Pillow 两种方式任选其一：
# 方式 1（推荐，系统包，免编译）
sudo apt-get install -y python3-pil
# 方式 2（pip 安装）
python3 -m pip install Pillow

# 浏览器模式（无窗口）
export HEADLESS=1
python3 app.py

# 原生窗口模式（需已安装 pywebview + WebKitGTK）
python3 app.py
```

浏览器模式启动后访问 `http://127.0.0.1:5000`。其他设备在同一局域网访问 `http://本机IP:5000`。

## 七、创建桌面快捷方式（可选，源码方式）

新建 `~/Desktop/QuickSend.desktop`：

```ini
[Desktop Entry]
Type=Application
Name=QuickSend
Comment=局域网文件与文字快速分享
Exec=/bin/bash /path/to/QuickSend/quicksend/quicksend/quicksend/start_kylin.sh
Icon=/path/to/QuickSend/quicksend/quicksend/quicksend/logo.png
Terminal=true
Categories=Network;
```

双击即可启动（终端窗口会保持运行，关闭终端即退出服务）。

## 八、开机自启（可选，systemd 用户服务）

```bash
mkdir -p ~/.config/systemd/user
cat > ~/.config/systemd/user/quicksend.service <<EOF
[Unit]
Description=QuickSend LAN Sharing
After=network.target

[Service]
Type=simple
WorkingDirectory=/path/to/QuickSend/quicksend/quicksend/quicksend
Environment=HEADLESS=1
Environment=PORT=5000
ExecStart=/usr/bin/python3 app.py
Restart=on-failure

[Install]
WantedBy=default.target
EOF

systemctl --user enable --now quicksend.service
```

> 开机自启适用于浏览器/服务模式（HEADLESS=1）。请将 `/path/to/...` 替换为实际路径。

## 九、常见问题

**Q1：pip 安装提示 `externally-managed-environment`？**
使用 `pip install --break-system-packages` 参数（start_kylin.sh 与 .deb 安装脚本已内置该回退逻辑）。

**Q2：怎么启用原生窗口？**
安装 .deb 时已自动尝试安装原生窗口组件；手动执行：

```bash
sudo apt-get install -y python3-gi gir1.2-webkit2-4.0
python3 -m pip install pywebview
```

若龙芯软件源不提供 WebKitGTK，将自动使用浏览器模式（功能不受影响）。强制浏览器模式：`./start_kylin.sh --headless`。

**Q3：Pillow 安装失败？**
先安装编译依赖：`sudo apt-get install -y build-essential libjpeg-dev zlib1g-dev`，再重试。

**Q4：其他设备无法访问？**
- 确认两台设备在同一网段
- 检查麒麟防火墙是否放行端口（默认 5000）：
  ```bash
  sudo firewall-cmd --add-port=5000/tcp --permanent   # 若使用 firewalld
  # 或使用图形化「安全中心-防火墙」放行
  ```

**Q5：如何停止服务？**
- 原生窗口：关闭窗口即退出
- 浏览器模式：在启动终端按 `Ctrl+C`；systemd 方式执行 `systemctl --user stop quicksend.service`

**Q6：想用 Docker 部署到龙芯 NAS？**
龙芯 NAS 可使用 `docker-compose-arm64.yml` 在设备上构建 arm64 镜像。LoongArch64 需使用 `linux/loong64` 架构镜像（需在龙芯本机或 QEMU 模拟环境构建）。

## 十、局限说明

- **原生窗口模式**依赖系统提供 WebKitGTK（`gir1.2-webkit2-4.0`）；若龙芯软件源不提供，将自动回退浏览器模式，功能不受影响
- 图片预览依赖 Pillow；若不安装，除图片相关功能外其余功能不受影响
