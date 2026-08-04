<div align="center">

<img src="quicksend/quicksend/maclogo.png" alt="QuickSend" width="128" />

# QuickSend

**在同一局域网内，在设备之间快速分享文件与文字 —— 无需云端、无需账号、无需配置。**

QuickSend 把你的电脑变成一台私密的分享中心。同一 Wi‑Fi 下的手机或另一台电脑扫码即可接入，秒传文件、在线预览。

**[English](README.md)** · [官网](https://quicksend.chat/) · [报告 Bug](https://github.com/foodpm/QuickSend/issues/new) · [功能建议](https://github.com/foodpm/QuickSend/issues/new)

![Version](https://img.shields.io/badge/version-1.0.19-2ea44f)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-0078d4)
![Docker](https://img.shields.io/badge/docker-foodpm%2Fquicksend-2496ed?logo=docker&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.8%2B-3776ab?logo=python&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-000000?logo=flask&logoColor=white)
![React](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=white)

</div>

## 目录

- [功能特性](#功能特性)
- [快速开始](#快速开始)
- [使用概览](#使用概览)
- [技术栈](#技术栈)
- [项目结构](#项目结构)
- [Docker 与 NAS 部署](#docker-与-nas-部署)
- [参与贡献](#参与贡献)
- [许可证](#许可证)

## 功能特性

- **即时传输** — 在同一 Wi‑Fi 下，在电脑、手机、其他电脑之间互传文件。无需数据线，不经过云端。
- **文字与链接分享** — 分享文字片段和网址，可选设置访问密码。
- **密码保护** — 为文件和文字加锁，保护敏感内容。
- **分组整理** — 多层级分组管理，支持模糊搜索与在线预览（图片、音频、CSV、XLSX、DOCX 等）。
- **二维码接入** — 对方扫码或在浏览器打开你的地址即可进入。
- **两种传输模式** — *共享中心*（远端可浏览已有内容）或*单向模式*（远端只能上传，适合收作业、收素材）。
- **天然私密** — 一切数据只停留在你的局域网内，无需注册账号。
- **跨平台** — 支持 Windows、macOS、Linux，以及 Docker 和 NAS 部署。

## 快速开始

### 桌面应用

1. 在 [Releases](https://github.com/foodpm/QuickSend/releases) 下载对应平台的安装包。
2. 运行安装包并打开 QuickSend。
3. 记下窗口中的地址和二维码，在同一网络的任意设备上打开即可使用。

### Docker

```bash
docker run -d --name quicksend \
  -p 8000:8000 \
  -v ./uploads:/app/uploads \
  -v ./data:/app/QuickSend \
  -e HEADLESS=1 \
  -e PORT=8000 \
  -e QUICKSEND_NO_BROWSER=1 \
  foodpm/quicksend:latest
```

然后在浏览器中打开 `http://localhost:8000`（或你的服务器/NAS IP）。

### 源码运行

需要 Python 3.8+。

```bash
cd quicksend/quicksend
pip install -r requirements.txt
python quicksend/app.py
```

## 使用概览

- **文件** — 上传、下载、预览、分组、加密码；可分享直链或二维码。
- **文本** — 新建、复制、分享、删除文本片段，支持设置密码。
- **分组与搜索** — 多层级分组整理内容，模糊搜索快速定位。
- **设置** — 修改保存位置、切换传输模式、保留 EXIF 拍摄日期、控制分组权限。
- **账号** — 可选注册，让主机识别「上传者」并限制删除/改密权限。

> 详细的图文使用说明见 [使用说明书](quicksend/quicksend/使用说明书.md)。

## 技术栈

| 层级 | 技术 |
| --- | --- |
| 后端 | Python、Flask、Werkzeug |
| 前端 | React 18、TypeScript、Vite、Tailwind CSS |
| 桌面端 | pywebview、PyInstaller |
| 部署 | Docker（多架构 amd64/arm64）、NAS（群晖 / 威联通 / 绿联） |
| 数据分析 | Supabase Edge Functions |

## 项目结构

```
.
├── quicksend/                 # 主应用
│   └── quicksend/
│       ├── app.py             # Flask 后端
│       ├── static/            # 前端（React + Vite）
│       ├── docs/              # 文档
│       ├── scripts/           # 构建脚本
│       ├── 使用说明书.md       # 用户指南
│       └── start_quicksend.bat # 免安装启动脚本（Windows）
├── supabase/                  # 数据分析函数与迁移
├── docker-compose*.yml        # Docker 部署
└── .github/workflows/         # CI/CD（构建、Docker 发布、Supabase 部署）
```

## Docker 与 NAS 部署

- Docker Hub 镜像：[`foodpm/quicksend`](https://hub.docker.com/r/foodpm/quicksend)
- 一键 Compose：[docker-compose.yml](docker-compose.yml)
- 配置说明：[DOCKER_CONFIG.md](DOCKER_CONFIG.md)
- NAS 离线导入教程（群晖 / 威联通 / 绿联）：[NAS 导入指南](quicksend/quicksend/docs/UGREEN_NAS_导入指南.md)

## 参与贡献

欢迎任何形式的贡献！欢迎提交 [Issue](https://github.com/foodpm/QuickSend/issues) 或 Pull Request。

## 许可证

本项目暂未指定开源许可证。如需使用或商用，请联系维护者。
