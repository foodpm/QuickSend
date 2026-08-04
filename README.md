<div align="center">

<img src="quicksend/quicksend/logo.png" alt="QuickSend" width="128" />

# QuickSend

**Share files & text instantly between devices over your local network — no cloud, no account, no configuration.**

QuickSend turns your computer into a private sharing hub. Any phone or another computer on the same Wi-Fi can connect, scan a QR code, and start uploading, downloading, and previewing files in seconds.

**[中文文档](README.zh-CN.md)** · [Website](https://quicksend.chat/) · [Report a Bug](https://github.com/foodpm/QuickSend/issues/new) · [Request a Feature](https://github.com/foodpm/QuickSend/issues/new)

![Version](https://img.shields.io/badge/version-1.0.18-2ea44f)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-0078d4)
![Docker](https://img.shields.io/badge/docker-foodpm%2Fquicksend-2496ed?logo=docker&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.8%2B-3776ab?logo=python&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-000000?logo=flask&logoColor=white)
![React](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=white)

</div>

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Usage Overview](#usage-overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Docker & NAS Deployment](#docker--nas-deployment)
- [Contributing](#contributing)
- [License](#license)

## Features

- **Instant transfer** — Move files between your computer, phone, and other computers on the same Wi-Fi. No cables, no cloud relay.
- **Text & link sharing** — Share snippets and URLs with optional password protection.
- **Password protection** — Lock files and texts to keep sensitive content private.
- **Organized groups** — Multi-level groups with fuzzy search and in-browser preview (images, audio, CSV, XLSX, DOCX, and more).
- **QR code access** — Guests join by scanning a QR code or opening your address in a browser.
- **Two transfer modes** — *Sharing hub* (guests can browse) or *one-way* (guests can only upload — great for collecting homework or assets).
- **Private by design** — Everything stays on your LAN. No registration required.
- **Cross-platform** — Windows, macOS, Linux, plus Docker and NAS deployment.

## Quick Start

### Desktop App

1. Download the installer for your platform from [Releases](https://github.com/foodpm/QuickSend/releases).
2. Run the installer and open QuickSend.
3. Note the address and QR code shown in the window, then open it from any device on the same network.

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

Then open `http://localhost:8000` (or your server/NAS IP) in a browser.

### Run from Source

Requires Python 3.8+.

```bash
cd quicksend/quicksend
pip install -r requirements.txt
python quicksend/app.py
```

## Usage Overview

- **Files** — Upload, download, preview, group, and password-protect files; share direct links or QR codes.
- **Texts** — Create, copy, share, and delete text snippets with optional passwords.
- **Groups & Search** — Organize content into multi-level groups; find anything with fuzzy search.
- **Settings** — Change the save location, switch transfer modes, keep EXIF capture dates, and control group permissions.
- **Accounts** — Optional sign-up lets the host identify uploaders and restrict delete/rename actions.

> For detailed step-by-step instructions, see the [中文使用指南](quicksend/quicksend/使用说明书.md) or the [Chinese README](README.zh-CN.md).

## Tech Stack

| Layer | Tech |
| --- | --- |
| Backend | Python, Flask, Werkzeug |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Desktop | pywebview, PyInstaller |
| Deployment | Docker (multi-arch amd64/arm64), NAS (Synology / QNAP / UGREEN) |
| Analytics | Supabase Edge Functions |

## Project Structure

```
.
├── quicksend/                 # Main application
│   └── quicksend/
│       ├── app.py             # Flask backend
│       ├── static/            # Frontend (React + Vite)
│       ├── docs/              # Documentation
│       ├── scripts/           # Build scripts
│       ├── 使用说明书.md       # User guide (Chinese)
│       └── start_quicksend.bat # Portable launcher (Windows)
├── supabase/                  # Analytics functions & migrations
├── docker-compose*.yml        # Docker deployment
└── .github/workflows/         # CI/CD (build, Docker publish, Supabase deploy)
```

## Docker & NAS Deployment

- Docker Hub image: [`foodpm/quicksend`](https://hub.docker.com/r/foodpm/quicksend)
- One-click Compose: [docker-compose.yml](docker-compose.yml)
- Configuration details: [DOCKER_CONFIG.md](DOCKER_CONFIG.md)
- Offline NAS import (Synology / QNAP / UGREEN): [NAS 导入指南](quicksend/quicksend/docs/UGREEN_NAS_导入指南.md)

## Contributing

Contributions are welcome! Feel free to open an [issue](https://github.com/foodpm/QuickSend/issues) or submit a pull request.

## License

This project does not specify an open-source license yet. Please contact the maintainer for usage or commercial inquiries.
