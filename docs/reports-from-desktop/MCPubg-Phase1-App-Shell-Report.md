# Phase 1 — UI App Shell (Electron + React + TypeScript)

**Date:** 2026-09-07
**Status:** Scaffold complete · 7/7 tests pass · Renderer builds clean
**UI chốt:** `C:\Users\ADMIN\Downloads\mcpubg_launcher_ui_minimal.html` (54.7 KB) ported 1:1 sang React

## 1. Mục tiêu

Xây app shell thật (không mockup) cho launcher, port UI chốt của anh sang React components, wire thật vào filesystem qua Electron main process, đọc state từ runtime install thật (Phase 0 evidence), chuẩn bị nền cho Phase 2 (Account+bộ cài) và Phase 3 (Play thật).

## 2. Stack chốt

- **Electron 33** (main + preload + renderer) — desktop window, native file dialogs, shell.openPath
- **React 18 + TypeScript 5.7** (strict mode, noUnusedLocals, noUnusedParameters)
- **Vite 6** cho renderer build (target ES2022, JSX react-jsx)
- **tsx** để chạy TypeScript trực tiếp cho test (Node 22+)
- **CSS thuần** — port 1:1 từ file HTML chốt, không Tailwind, không styled-components
- **Không emoji** — chỉ SVG icon inline (Lucide-style, 1.75px stroke)

## 3. Cấu trúc đã build

```
D:/2026WORK/MCPubgLauncherV2/phase1-app/
├── package.json
├── tsconfig.json                # renderer (ESM, JSX, strict)
├── tsconfig.electron.json       # main/preload (CJS, no JSX)
├── vite.config.ts               # Vite build
├── src/
│   ├── shared/                  # import được từ main, preload, renderer
│   │   ├── types.ts             # Launcher.AppState, Instance, IpcApi, etc.
│   │   └── ipc-channels.ts      # const enum IPC channel names
│   ├── main/
│   │   ├── main.ts              # Electron app, BrowserWindow, ipcMain handlers
│   │   └── instance-adapter.ts  # đọc .runtime/clean → AppState
│   ├── preload/
│   │   └── preload.ts           # contextBridge.exposeInMainWorld('launcher', api)
│   └── renderer/
│       ├── index.html
│       ├── main.tsx             # createRoot + mount App
│       ├── styles.css           # port từ HTML chốt (1:1, ~14.7 KB)
│       └── components/
│           ├── App.tsx          # 3-tab router + IPC bootstrap
│           ├── Sidebar.tsx      # brand + 3 nav + user popover
│           ├── HomeScreen.tsx   # hero + ambient canvas + play-dock
│           ├── LibraryScreen.tsx # 3 instance card + add card
│           ├── SettingsScreen.tsx # RAM slider + Java + Log + Cache
│           ├── LogModal.tsx     # 4-stream log viewer + Save/Xóa
│           ├── Toast.tsx        # 4 loại (success/warn/error/info) + setter global
│           └── Icons.tsx        # 14 SVG icon Lucide-style
└── tests/
    ├── smoke.mjs                # build + data-testid + zero emoji
    ├── instance-adapter.test.mjs # đọc state thật từ Phase-0 runtime
    └── _print-state.ts          # helper cho test
```

## 4. Mapping UI chốt → React component

| UI chốt (HTML) | React component | data-testid |
|---|---|---|
| `.brand` (logo M + tên) | `<Sidebar brand>` | `brand` |
| `.nav-item` × 3 | `<Sidebar nav>` | `nav-home`, `nav-library`, `nav-settings` |
| `.nav-badge-dot` | inline trong Sidebar | `nav-badge-dot` |
| `.user-card` + popover | `<Sidebar user>` | `user-card`, `user-popover`, `popover-rename`, `popover-signout` |
| `#screen-home` + hero + canvas | `<HomeScreen>` | `screen-home`, `hero`, `server-status`, `play-dock` |
| `.play-dock` (instance picker + Play) | `<HomeScreen dock>` | `instance-select`, `instance-meta`, `btn-play`, `play-text` |
| `#screen-library` + cards | `<LibraryScreen>` | `screen-library`, `instance-grid`, `add-instance`, `instance-card-{id}`, `status-{id}`, `action-{id}-{action}` |
| `#screen-settings` | `<SettingsScreen>` | `screen-settings`, `setting-ram`, `ram-slider`, `ram-value`, `setting-java`, `java-status`, `setting-log`, `btn-open-log`, `setting-cache`, `btn-clean` |
| `#logModal` (modal log) | `<LogModal>` | `log-modal`, `btn-close-log`, `log-stream`, `btn-clear-log`, `btn-save-log`, `log-console` |
| `.toast` 4 loại | `<ToastHost>` + `showToast()` | `toast`, `toast-msg`, `toast-icon-{type}` |

**47 unique data-testid** đảm bảo mọi node tương tác đều có selector ổn định cho Playwright (Phase 1.5).

## 5. Test thật — 7/7 pass

```
$ node --test --test-reporter=spec tests/*.test.mjs tests/*.mjs
✔ adapter returns at least one instance (1880ms)
✔ adapter reports Forge 47.4.10 as ready (1811ms)
✔ adapter detects Java correctly (1805ms)
✔ adapter default RAM is 4096 MB and hasUpdate true (1820ms)
✔ renderer build exists (1ms)
✔ bundle contains every required data-testid (static + dynamic templates) (3ms)
✔ bundle has zero emoji characters in source (3ms)
ℹ tests 7
ℹ pass 7
ℹ fail 0
```

**Adapter test đọc state THẬT từ Phase-0 runtime** (không mock):
- Detect 2 instance trong `.runtime/clean/versions/`: `1.20.1` (vanilla, status empty) và `1.20.1-forge-47.4.10` (Forge, status ready, 49 mods)
- Auto-select Forge làm default
- Java path detect đúng `C:/Program Files/Microsoft/jdk-17.0.20.101-hotspot/bin/javaw.exe`
- RAM default 4096 MB
- hasUpdate = true (chưa thật wire GitHub, chỉ hardcode)

**Smoke test**:
- Vite build sinh ra JS 162 KB (gzip 52 KB), CSS 13 KB
- 47 data-testid đều có mặt trong bundle
- Source code KHÔNG có emoji (regex kiểm tra tất cả components)

## 6. Build artifact

```
dist/renderer/index.html                   0.71 kB │ gzip:  0.40 kB
dist/renderer/assets/index-*.css          12.78 kB │ gzip:  3.22 kB
dist/renderer/assets/index-*.js          162.48 kB │ gzip: 51.78 kB │ map: 394.64 kB
```

Mở `dist/renderer/index.html` bằng browser thấy ngay UI chốt (chưa có IPC, state rỗng).

## 7. Chưa làm (sang Phase tiếp)

| Hạng mục | Phase | Lý do chưa làm |
|---|---|---|
| Wire thật `launchInstance` vào Java 17 spawn | Phase 3 | Phase 1 tập trung UI shell + state adapter |
| Microsoft OAuth + AZauth | Phase 2 | Cần Azure app registration + test trước |
| Modpack auto-update từ GitHub Releases | Phase 2 | Cần API token + test thật |
| Real WebSocket proxy (mc.tiulong.site) | Phase 3 | Cần SSH VPS (user không ở nhà) |
| Code signing + EXE packaging (electron-builder) | Phase 5 | Sau khi Phase 3-4 ổn định |
| Playwright E2E walkthrough (3 role, 3 màn × screenshot) | Phase 1.5 | Sau khi review Phase 1 |
| Figma polish nếu cần | Tùy anh | UI chốt đã đẹp, chưa cần Figma lại |

## 8. Pitfalls gặp & đã fix

1. **Vite optimize data-testid literal**: test ban đầu dùng regex `data-testid="x"`, fail vì bundle output là `data-testid":"x"`. Đã fix regex thành `data-testid":"x"` cho static, `data-testid":\`x\`` cho dynamic template.

2. **Dynamic template strings**: `data-testid={\`instance-card-${inst.id}\`}` không phải literal trong bundle (Vite preserve template). Test phải check 2 dạng: literal `\"x\"` và backtick `\`x\``.

3. **Forge client jar bị mất**: Sau khi re-run `forge-installer.jar --installClient`, file `1.20.1-forge-47.4.10-client.jar` 4.85MB bị xóa khỏi `versions/` folder. Installer báo "Successfully installed" nhưng binarypatcher processor không tạo file (bị skip ở re-run). Đã copy lại từ `libraries/net/minecraftforge/forge/1.20.1-47.4.10/forge-1.20.1-47.4.10-client.jar` vào `versions/`.

4. **Auto-selected instance sai**: ban đầu sort alphabetically → `1.20.1` (vanilla) được chọn thay vì `1.20.1-forge-47.4.10`. Đã fix: chọn instance có `hasClient = true` trước.

5. **node_modules lock Windows**: lần đầu install electron bị kẹt do Windows file lock. Workaround: tách deps nhẹ (React + Vite + TS) trước, electron sẽ install ở Phase 1.5 khi thật sự cần chạy app.

## 9. Cách chạy (khi user cần thử)

```bash
cd D:/2026WORK/MCPubgLauncherV2/phase1-app
npm install                    # ~5 phút (electron 33 + Vite 6 + React 18)
npm run dev:renderer           # Vite dev server http://127.0.0.1:5173
npm run build:renderer         # build dist/renderer/
node --test tests/*.test.mjs tests/*.mjs  # 7/7 pass
```

Khi Phase 1.5 (Playwright) chạy sẽ cần `npm install playwright` + `npx playwright install chromium`.

## 10. Next bước đề xuất

**Phase 1.5 (1-2 giờ)**: Playwright E2E walkthrough — 3 role × 3 màn = 9 screenshot, bắt console error, network ≥400, vision-analyze mỗi screenshot. Bắt buộc trước khi qua Phase 2.

**Phase 2 (4-6 giờ)**: Account management (Offline + Microsoft OAuth + AZauth) + Modpack auto-update từ GitHub Releases. Cần anh cấp Azure app registration trước.
