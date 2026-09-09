# MCPubg Launcher — End Product Plan (từ 2026-09-08 đến ship)

> Plan chốt phases còn lại (2 → 6) + acceptance gate end product. Mỗi phase có demo + evidence + test thật trước khi qua phase tiếp. Anh duyệt phase xong em làm tiếp.

## Trạng thái hiện tại (đã xong)

| Phase | Trạng thái | Evidence |
|---|---|---|
| **0. Engine qualify** | ✅ DONE | `Desktop/MCPubg-Phase0-Engine-Report.md` — 6/6 test pass, Forge 47.4.10 install canonical, 49 mods scan & load, 4 non-fatal mod lỗi đã document |
| **0.5. Full-pack qualification** | ✅ DONE | `Desktop/MCPubg-Phase0-Pack-Qualification.json` + `Desktop/MCPubg-Phase0-Launch-Logs/` — 48/49 mods load, 0 missing dep |
| **1. UI App shell** | ✅ DONE | `Desktop/MCPubg-Phase1-App-Shell-Report.md` — Electron + React + TS, 7/7 test pass, 47 data-testid, UI chốt port 1:1 |

## Goal end product

MCPubg Launcher phát hành được (Windows installer .exe), dùng được end-to-end:
1. Mở app → thấy UI chốt → tự detect Java 17 + instance
2. Bấm **VÀO GAME** → Java spawn → MC render → join server `mc.tiulong.site` qua WebSocket proxy
3. Tài khoản Offline + Microsoft OAuth + AZauth
4. Modpack auto-update từ GitHub Releases
5. Settings: RAM, Java, log viewer, cache clean
6. Crash → log viewer hiện ngay, copyable

## Tech stack chốt

- **Frontend**: Electron 33 + React 18 + TypeScript 5.7 + Vite 6
- **Backend (main process)**: Node 22 + `@xmcl/core` 2.15.1 + `@xmcl/installer` 6.1.2 (Phase 0 đã qualify)
- **Forge launcher**: Custom command builder (skill `forge-launch-command.md`) — KHÔNG dùng `minecraft-launcher-lib` vì thiếu module-path handling
- **WebSocket proxy** (mc.tiulong.site → VPS :8081 → MC :25565): Embedded Node `ws` library (chạy background trong main process)
- **State**: JSON files trong `%APPDATA%/MCPubgLauncher/`
- **Package**: electron-builder → .exe installer
- **Code signing**: Bỏ qua (chưa có cert, gắn nhãn "unsigned" cho v1)

## Phases còn lại

### Phase 1.5 — Playwright E2E walkthrough (2 giờ)
- Connect Edge headful, dùng CDP (`connectOverCDP`)
- Walk qua 3 màn: Home / Library / Settings
- Click từng node có `data-testid` (47 nodes)
- Bắt console error + network ≥400
- Vision-analyze từng screenshot (smoke test không thấy visual bug)
- Output: 6 screenshot Desktop + `phase-1.5-walkthrough.mjs` script

**Gate**: 0 console error, 0 network 4xx/5xx, 3 màn render đúng UI chốt.

### Phase 2 — Account + Modpack auto-update (4-6 giờ)
**2A. Accounts**
- `account-store.ts` — đọc/ghi `%APPDATA%/MCPubgLauncher/accounts.json`
- Offline: tạo UUID random từ username, lưu local
- Microsoft OAuth: cần Azure app registration (AZURE_CLIENT_ID) — em wire sẵn UI, anh tạo Azure app xong cắm ID vào
- AZauth: experimental, URL + auth secret form
- Active account: hiển thị trên user-card sidebar, switch bằng click

**2B. Modpack auto-update**
- `update-store.ts` — so sánh version hiện tại với GitHub Releases API
- Endpoint: `https://api.github.com/repos/tieulong07/mcpubg-modpack/releases/latest`
- Download ZIP → verify SHA-256 → backup mods cũ → extract đè
- Hiện update badge trên sidebar (đã có) + progress bar trong Settings
- Rollback nếu SHA mismatch

**Gate**: Tạo account offline OK, switch giữa 3 account, GitHub API call thật trả về release mới nhất, ZIP download 200MB verify SHA pass, restart app thấy version mới.

### Phase 3 — Play + Server + Lifecycle (6-8 giờ) ⚠️ QUAN TRỌNG NHẤT
**3A. Java command builder** (`launcher/forge-command.ts`)
- Port `forge-launch-command.md` sang TypeScript
- Auto-detect Java 17: Microsoft JDK → Adoptium Temurin → TLauncher Java 17
- Split jars: module-path vs -cp (modlauncher MUST be on -cp, Pitfall 4)
- `LAUNCHER_VERSION` env var bắt buộc
- Native DLLs cleanup (filter `*.dll` only, xóa `module-info.class`)

**3B. Process spawn** (`launcher/forge-process.ts`)
- `child_process.spawn` với `DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP` (Windows)
- Stream stdout/stderr → IPC `launcher:on-log` → React `<LogModal>`
- State machine: `idle → launching → running → failed`
- Kill: `taskkill /F /PID` chỉ khi user confirm (KHÔNG auto-kill)

**3C. WebSocket proxy** (`proxy/ws-bridge.ts`)
- Embedded Node server: 127.0.0.1:25566 → wss://mc.tiulong.site:443
- Start trước khi launch MC, stop sau khi kill
- Log mỗi connect/disconnect → log stream
- Auto-reconnect với backoff (1s, 2s, 4s, 8s, 30s cap)
- Heartbeat ping 30s

**3D. Verify on real machine** (cần anh ngồi trước desktop)
- Bấm VÀO GAME → spawn Java 17 → MC render trong 8-10s → join server thật
- Alt+F4 thoát MC → state về idle
- Kill button → kill MC + proxy, save log

**Gate**: 
- `node scripts/launch-verify.mjs` chạy được MC 60s (background) + log 100+ dòng
- App thật: bấm VÀO GAME → MC render → click Multiplayer → server list có `mc.tiulong.site` → join → vào game

### Phase 4 — Update/Repair/Rollback (3-4 giờ)
**4A. Update**
- "Cập nhật v0.0.3" button trên instance card → fetch GitHub release → download → backup `mods/` → extract → verify
- Progress toast: "Đang tải 142 MB... 45%"
- Cancel button giữa chừng → rollback tự động

**4B. Verify (Sửa lỗi)**
- "Sửa lỗi" button → check SHA-256 từng mod vs manifest → report file lệch
- Auto-restore từ backup nếu có

**4C. Cleanup**
- "Dọn dẹp" button → xóa `downloads/cache/`, `logs/forge-stdout.log > 10MB`, `crash-reports/`
- Tính freed bytes → toast

**Gate**: Update 1 modpack từ v0.0.2 → v0.0.3 OK, verify 49 mod SHA pass, cleanup giải phóng ≥100MB.

### Phase 5 — Polish (2-3 giờ)
- Skeleton loading khi launch (spinner 200ms)
- Empty state cho library khi 0 instance
- Keyboard shortcut: Ctrl+L mở log modal, Ctrl+, mở settings
- Window state: nhớ vị trí/cỡ cửa sổ, restore on next launch
- Auto-update launcher: check GitHub releases daily, badge "Có bản mới"

**Gate**: Visual regression test pass (3 màn screenshot identical baseline).

### Phase 6 — Package + Acceptance (3-4 giờ)
**6A. Build EXE**
- `electron-builder` config cho Windows x64
- Bundle Java 17 runtime (Adoptium Temurin 17 JRE) → EXE tăng ~50MB
- Bundle `assets/icons/` (logo, brand)
- Output: `MCPubgLauncher-Setup-0.1.0.exe` (~150MB)

**6B. Acceptance test**
- Clean Windows VM → cài EXE → mở app → install instance mới trong 5 phút → bấm VÀO GAME → MC render → join server
- Doc lại từng bước, screenshot, log evidence
- Output: `Desktop/MCPubg-Phase6-Acceptance-Test.md`

**6C. User docs**
- `README.md` trong repo
- `Desktop/MCPubg-Launcher-User-Guide.pdf` (1 trang, screenshot chính)

**Gate**: Fresh install → join server thành công trong 10 phút.

## Tổng thời gian ước tính

| Phase | Thời gian | Cần gì từ anh |
|---|---|---|
| 1.5 Playwright E2E | 2h | — |
| 2 Account + Update | 4-6h | Azure app registration (cho Microsoft OAuth) |
| 3 Play + Server | 6-8h | Anh ngồi trước desktop 30 phút để visual verify |
| 4 Update/Repair | 3-4h | Modpack release thật trên GitHub |
| 5 Polish | 2-3h | — |
| 6 Package + Accept | 3-4h | Anh cài EXE lên máy khác test |
| **Tổng** | **20-27h** | ~3-4 ngày làm việc liên tục |

## Mỗi phase output

Mỗi phase khi xong em sẽ gửi:
- 1 file `MCPubg-PhaseX-...-Report.md` ra Desktop
- Test results pass/fail cụ thể
- Screenshot/video nếu có UI
- Git commit hash (nếu anh muốn track)

## Risk register

| Risk | Mitigation |
|---|---|
| Microsoft OAuth fail vì thiếu Azure app | Phase 2 chỉ wire UI, cần anh tạo app trước khi test thật. Fallback: ẩn Microsoft tab nếu AZURE_CLIENT_ID chưa set. |
| VPS unreachable mid-test | Skill `dhcp-ip-recovery.md` có sẵn recipe. Em check IP mỗi lần trước khi SSH. |
| Modpack update corrupt 49 mods | Phase 4 verify SHA-256 trước khi commit, giữ backup 7 ngày. |
| electron-builder EXE quá lớn (>200MB) | Không bundle Java, expect user có Java 17 sẵn. Hoặc bundle Adoptium JRE 30MB (chỉ runtime, không JDK) |
| User không quen CLI để verify visual | Phase 3D cần anh confirm render. Em chuẩn bị script check tự động: window process alive + log có "OpenGL 4.6" + "joined server". |

## Những việc em làm NGAY bây giờ (trong khi anh ngủ)

1. **Phase 1.5**: Playwright walkthrough qua 3 màn, capture 6 screenshot, vision-analyze.
2. **Phase 2A** (Accounts): wire account-store + UI offline + UI Microsoft (mock OAuth flow) + UI AZauth (stub).
3. **Phase 3A** (Forge command builder): port từ `forge-launch-command.md` skill, viết unit test.

Sáng mai anh dậy em sẽ có:
- 6 screenshot Phase 1.5
- Accounts modal hoạt động (mock OAuth có thể test)
- Forge command builder pass unit test với `assert.equal(args.includes('cpw.mods.bootstraplauncher/cpw.mods.bootstraplauncher.BootstrapLauncher'))`

Anh dậy check, duyệt tiếp Phase 3B (process spawn) + Phase 3C (WS proxy) → em sẽ chạy thật trên VPS lúc 9h sáng mai (nếu anh OK).

OK anh, em bắt đầu ngay.
