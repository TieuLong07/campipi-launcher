# Campipi Launcher

> A minimal, dark-themed Minecraft launcher for the MCPubg modpack
> (Forge 1.20.1, 50+ mods). Built on Electron + React + TypeScript.

[![License: BSL 1.1](https://img.shields.io/badge/License-BSL_1.1-orange.svg)](./LICENSE)
[![Node >=22](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](https://nodejs.org)
[![Electron 33](https://img.shields.io/badge/electron-33-blue.svg)](https://www.electronjs.org)

---

## Features

- **TLauncher-style instance management** — shared `.minecraft` root at
  `%APPDATA%/.minecraft`, per-instance folders at `versions/<name>/` with
  isolated mods/saves/config
- **GitHub modpack updates** — automatic check against
  [TieuLong07/mcpubg-modpack](https://github.com/TieuLong07/mcpubg-modpack)
  with SHA256 verification and one-click apply
- **Built-in WebSocket proxy** — play multiplayer through a local proxy
  (handles Cloudflare-proxied servers, no port forwarding needed)
- **No telemetry, no ads, no online account required** — works fully offline
  with offline-mode accounts

## Screenshots

_Add `docs/evidence/screenshots/` and reference them here._

## Quick Start (from source)

### Prerequisites
- Windows 10/11
- Node.js ≥ 22
- Java 17 (bundled installers available; launcher auto-detects JDKs)
- A Minecraft Forge 1.20.1 instance (create one with any launcher first —
  TLauncher, MultiMC, or a vanilla launcher — and put it in
  `%APPDATA%/.minecraft/versions/<name>/`)

### Build
```bash
cd phase1-app
npm install
npm run build:all       # tsc + vite
npm run package:dir     # build unpacked Win64 app (may fail on non-admin Windows)
```

If `package:dir` fails with a `winCodeSign` symlink error
([electron-builder#8149](https://github.com/electron-userland/electron-builder/issues/8149)),
use the asar extract/repack workaround:
```bash
# 1. extract existing app.asar
node_modules/.bin/asar extract release/win-unpacked/resources/app.asar asar-extract
# 2. copy fresh build output
cp dist/main/*.js asar-extract/dist/main/
cp -r dist/renderer/* asar-extract/dist/renderer/
# 3. repack
node_modules/.bin/asar pack asar-extract release/win-unpacked/resources/app.asar
```

### Run
```bash
# Dev (Vite + Electron)
npm run dev:renderer
# in another terminal:
npx electron dist/main/main.js

# Production (use the .exe in release/win-unpacked/)
./release/win-unpacked/MCPubg\ Launcher.exe
```

## Architecture

```
src/
  main/                    # Electron main process
    main.ts                # App lifecycle, IPC handlers, window mgmt
    launcher-manager.ts    # XMCL-based Minecraft launch
    instance-adapter.ts    # Scan %APPDATA%/.minecraft/versions → render state
    mod-updater.ts         # GitHub modpack manifest fetcher + SHA256 verifier
    proxy-manager.ts       # WebSocket proxy (wss:// → tcp://)
    repair.ts              # Cache cleanup, integrity check
  renderer/                # React UI
    components/
      App.tsx              # Top-level layout (3 tabs: Library / News / Settings)
      LibraryScreen.tsx    # Instance list + Play button
      UpdateBanner.tsx     # Modpack update notification
      ...
    styles.css
  preload/
    preload.ts             # contextBridge IPC bindings
  shared/
    ipc-channels.ts        # IPC channel name constants
    types.ts               # Shared TypeScript types
```

## Instance Layout (TLauncher-compatible)

```
%APPDATA%/.minecraft/                          ← shared root
├── assets/                                    ← shared game assets
├── libraries/                                 ← shared game libraries
├── versions/
│   ├── 1.20.1-forge-47.4.10/                 ← shared Forge install
│   │   ├── 1.20.1-forge-47.4.10.jar
│   │   └── 1.20.1-forge-47.4.10.json
│   ├── cam/                                   ← per-instance folder
│   │   ├── cam.json
│   │   ├── mods/                              ← 50 mods here
│   │   ├── saves/                             ← per-instance worlds
│   │   ├── config/
│   │   └── .mcpubg-version                    ← local modpack version file
│   └── <other instances>/
└── logs/
```

This matches the layout used by TLauncher, so instances created in any
other launcher show up automatically.

## License

**Business Source License 1.1** — see [LICENSE](./LICENSE).

- ✅ Personal, educational, and non-commercial use
- ❌ Commercial use without a separate license
- ⏰ On **2029-09-09** the license automatically converts to **GPL-3.0-or-later**

Inspired by the OpenClaw Hermes dual-license model.

## Credits

- **Author**: TieuLong07 (Nguyen Hoang Long) — <nguyenhlong2203@gmail.com>
- **Modpack**: [TieuLong07/mcpubg-modpack](https://github.com/TieuLong07/mcpubg-modpack)
- **Built with**: [Electron](https://electronjs.org),
  [React](https://react.dev),
  [Vite](https://vitejs.dev),
  [@xmcl/core](https://github.com/Voxelum/x-minecraft-launcher)

---

> "campipi" is the codename for this project on the author's machine.
> The user-facing name is **MCPubg Launcher**.
