# QuickSend Overview

QuickSend is a private file- and text-sharing application for your local network. It turns your computer, NAS, or server into a lightweight sharing hub, so any phone or computer on the same Wi-Fi can connect through a browser, scan a QR code, and start transferring files in seconds.

No cloud relay. No account required. No cables or complicated setup.

## Highlights

- **Instant local transfers** — Move files between a host computer, phones, tablets, and other computers over the same Wi-Fi or hotspot.
- **Text and link sharing** — Share notes, passwords, URLs, or code snippets as quick text items.
- **Browser-based access** — Guests do not need to install QuickSend; they open the host address or scan the QR code.
- **Password protection** — Lock individual files and text snippets before sharing sensitive content.
- **Groups and search** — Organize files and texts into multi-level groups and find them quickly with fuzzy search.
- **In-browser previews** — Preview images, audio, CSV, XLSX, DOCX, and other supported formats before downloading.
- **Optional accounts** — Let the host identify uploaders and control who can delete, rename, or change passwords.
- **Cross-platform deployment** — Runs on Windows, macOS, Linux, Docker, and NAS devices.

## How It Works

1. Start QuickSend on the host computer, NAS, or server.
2. Open the address or scan the QR code shown by the app from another device on the same network.
3. Upload files, download shared files, preview content, or share text snippets.
4. Organize everything into groups, add passwords where needed, and manage permissions from the host.

QuickSend supports two transfer modes:

- **Sharing hub** — Connected devices can browse and download existing content.
- **One-way mode** — Connected devices can upload files but cannot browse existing content. This is useful for collecting homework, assets, photos, or submissions.

## Typical Use Cases

- Send photos from a phone to a laptop without a cable.
- Collect files from students, teammates, clients, or event attendees.
- Share documents across a home or office network.
- Move files between different operating systems without USB drives.
- Share Wi-Fi passwords, links, or short notes with people in the same room.

## Getting Started

### Desktop App

1. Download the installer for your platform from the [GitHub Releases page](https://github.com/foodpm/QuickSend/releases).
2. Install and open QuickSend.
3. Use the address or QR code displayed in the QuickSend window to connect another device.

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

Then open `http://localhost:8000` or `http://<server-ip>:8000` in a browser.

### Run from Source

Python 3.8 or newer is required.

```bash
cd quicksend/quicksend
pip install -r requirements.txt
python quicksend/app.py
```

## Privacy and Control

QuickSend is designed to keep data on your own network. Files remain on the host machine or deployment volume unless you choose to move them. Password protection, optional user accounts, hidden groups, and host-only configuration actions give you fine-grained control over what guests can see and do.

## Technology

| Area | Technology |
| --- | --- |
| Backend | Python, Flask, Werkzeug |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Desktop | pywebview, PyInstaller |
| Deployment | Docker, NAS platforms |
| Analytics | Supabase Edge Functions |

## Links

- Website: [https://quicksend.chat/](https://quicksend.chat/)
- Releases: [GitHub Releases](https://github.com/foodpm/QuickSend/releases)
- Docker image: [foodpm/quicksend](https://hub.docker.com/r/foodpm/quicksend)
- Issues and feature requests: [GitHub Issues](https://github.com/foodpm/QuickSend/issues)

The project currently does not specify an open-source license. Contact the maintainer for licensing or commercial questions.
