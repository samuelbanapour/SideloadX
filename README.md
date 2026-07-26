# SideloadX

## Overview
All-in-one iOS app sideloading tool. Like AltStore, Sideloadly, and SideStore combined — but as a native desktop app.

## Features
- **IPA Management** — Drag & drop IPA files, parse metadata, extract icons
- **Code Signing** — Sign apps with your own certificates (P12) or ad-hoc signing
- **Device Management** — Install signed apps via USB (libimobiledevice) or OTA (itms-services://)
- **Account Management** — Add multiple Apple IDs to bypass free developer limits (3 apps x N accounts)
- **App Sources** — Browse apps from AltStore-compatible sources
- **Auto-Refresh** — Automatically re-sign apps before they expire
- **Modern UI** — Built with React + Tailwind CSS, dark theme

## Prerequisites
- Node.js 18+ (for sql.js WASM support)
- macOS (for code signing; Linux/Windows have limited signing support)
- libimobiledevice (for USB device management): `brew install libimobiledevice`

## Install & Run
```bash
git clone https://github.com/samuelbanapour/SideloadX.git
cd SideloadX
npm install
npm run dev
```

For web-only dev (no Electron):
```bash
npm run dev:web
```

## Build
```bash
# Build web bundle only
npm run build:web
```

## Architecture
- **Electron main process** (Node.js) — IPC handlers, services (signing, device management, sources)
- **React renderer** — UI with framer-motion animations, lucide-react icons
- **sql.js** — SQLite database stored in user data directory
- **Vite** — Fast dev server and production builds

## Security
- Apple ID passwords stored locally in SQLite database
- Uses app-specific passwords (recommended)
- HTTPS server uses self-signed certificate for OTA installation
- Network requests only go to Apple's authentication services and configured source URLs
