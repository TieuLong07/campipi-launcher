# MCPubg Launcher — Context Notes

**Last updated**: 2026-09-09
**Project root**: `D:/2026WORK/Campipi/`
**Session ID**: `20260907_122237_0e676e1c`

---

## Trạng thái hiện tại (2026-09-09)

### ✅ Đã hoàn thành
1. **XMCL-based launch** — game chạy OK (Forge 1.20.1 + 50 mods)
2. **Client-side WebSocket proxy** — proxy-manager chạy trên port 25566
3. **Server connection** — connect được `mc.tiulong.site` qua Cloudflare Tunnel
4. **Settings proxy status** — hiển thị Running/Stopped, Traffic, Restart/Stop buttons
5. **UI split** — "Modpack của Cam" (MCPUBG) vs "Instance khác"
6. **Mod update checker** — code xong, dùng manifest từ VPS (CHƯA host được do Cloudflare force WebSocket)
7. **EXE v0.2.0** — `C:/Users/ADMIN/Desktop/MCPubg-Launcher-v0.2.0-portable/MCPubg Launcher.exe`

### 🔄 Đang làm (2026-09-09)
- **FRP Migration** — plan xong tại `D:/2026WORK/Campipi/docs/FRP-Migration-Plan.md`
- Chờ anh mua VPS 10k + cung cấp IP + ports

### ⏳ Backlog
- Mod update hosting (giải quyết bằng R2 HOẶC VPS mới)
- Standalone launcher (auto-install Java + MC trên máy mới)
- Microsoft OAuth (stub only)
- AZauth experimental (stub only)
- News feed (Phase 5)

---

## VPS Info

### my-vps (VPS nhà — Home PC behind NAT)
- **OS**: Ubuntu 24.04
- **Spec**: 8GB RAM, 4 cores (anh tự build)
- **IP**: 192.168.1.7 (LAN), 14.254.247.71 (router public, no port forward)
- **SSH**: `ssh vps` (alias → mc.tiulong.site)
- **Java**: 17
- **MC Server**: `/home/long/minecraft-server/`, port 25565
- **World reset**: DONE 2026-09-09 (`world_backup_20260909/`)
- **Pterodactyl**: Panel :8080, Wings running
- **Cloudflare Tunnel**: `mc.tiulong.site` → `http://127.0.0.1:8081` (wsproxy)
- **wsproxy**: `/usr/local/bin/wsproxy.py`, port 8081
- **Credentials**: `~/pterodactyl-creds.txt`

### VPS mới (CHƯA MUA — anh sẽ mua)
- **Provider**: TBD
- **Plan**: 10k VND/tháng (1GB RAM, 4 ports, NAT VPS Ubuntu)
- **Mục đích**: FRP server (frps) thay thế Cloudflare Tunnel
- **Cần**: IP + 2 ports (bind port 7000 + game port 25565)

---

## Launcher Architecture

### Stack
- **Electron 33** + **React 18** + **TypeScript 5.7** + **Vite 6** + **electron-builder 25**
- **@xmcl/core 2.15.1** (PINNED!) — launch integration
- **Java 17** (Microsoft JDK)

### Key Files
- `src/main/forge-command.ts` (147 lines) — XMCL `generateArguments()`
- `src/main/launcher-manager.ts` — game spawn + proxy auto-start
- `src/main/proxy-manager.ts` — WebSocket proxy (sẽ replace bằng FRP)
- `src/main/ws-proxy.ts` — WebSocket-to-TCP bridge
- `src/main/account-handlers.ts` (89 lines) — account CRUD
- `src/main/instance-adapter.ts` — detect instances + add mcpubg
- `src/main/mod-updater.ts` — check update từ manifest
- `src/renderer/components/App.tsx` (119 lines) — main UI
- `src/renderer/components/LibraryScreen.tsx` — instance list (split sections)
- `src/renderer/components/SettingsScreen.tsx` — settings + proxy status
- `src/renderer/components/UpdateBanner.tsx` — update notification

### IPC Channels
- `LAUNCHER:LAUNCH`, `LAUNCHER:STOP`
- `PROXY_STATUS`, `PROXY_RESTART`, `PROXY_STOP`
- `CHECK_UPDATE`, `APPLY_UPDATE`
- Account: `ACCOUNTS_GET`, `ACCOUNTS_CREATE`, etc.

### Test
- **Framework**: Vitest
- **Result**: 38/38 pass (pre latest rewrites — cần re-verify)
- **Command**: `cd phase1-app && npm test`

---

## Mod Update Hosting

### Vấn đề
- Cloudflare Tunnel force WebSocket upgrade → không serve HTTP files được
- Mod updater dùng HTTP → fail

### Options đã discuss
1. ❌ **Cloudflare R2** — em đề xuất, nhưng anh chọn Option 2
2. ⏳ **GitHub Releases** — free, nhưng cần public repo
3. ⏳ **VPS mới (FRP)** — sau khi migrate, có thể host mods luôn

### Manifest location (current)
- VPS: `/var/www/mcpubg/modpack-manifest.json`
- Mods: `/var/www/mcpubg/mods/*.jar` (50 mods)
- URL: `https://mc.tiulong.site/modpack-manifest.json` (CHƯA hoạt động — Cloudflare force WebSocket)

---

## FRP Migration

### Plan file
`D:/2026WORK/Campipi/docs/FRP-Migration-Plan.md`

### Steps
1. ⏳ **Phase 1**: Anh mua VPS, cung cấp IP + ports
2. ⏳ **Phase 2**: Em setup frps trên VPS
3. ⏳ **Phase 3**: Em setup frpc trên home PC
4. ⏳ **Phase 4**: Em update launcher (auto-start frpc)
5. ⏳ **Phase 5**: Em cleanup Cloudflare Tunnel
6. ⏳ **Phase 6**: Test end-to-end

### Config templates
- frps.toml: bind port 7000
- frpc.toml: forward VPS:25565 → localhost:25565

---

## UI Design Rules (2026-09-04)

1. **CẤM emoji** trong UI — dùng SVG icon, illustration, shape/typography
2. **Workflow app mới**: Figma design trước → review → code
3. **UI canonical**: `C:/Users/ADMIN/Downloads/mcpubg_launcher_ui_minimal (1).html` (54.7 KB) — KHÔNG touch
4. **UI port**: nguyên CSS từ file trên
5. **Icon**: Lucide-style inline SVG, 1.75px stroke, currentColor
6. **data-testid**: mỗi node tương tác có testid ổn định

### UI choices chốt
- **3 tab**: Library / Settings / Account
- **Play bar**: sticky bottom
- **No Join button** — chỉ Play
- **Log**: ở Settings tab
- **Status dot**: `nav-badge-dot`
- **Font**: Plus Jakarta Sans
- **Accent**: terracotta `#e0532c`
- **Theme**: dark
- **Language**: VN+EN toggle
- **Server**: hardcode `mc.tiulong.site` + manual add
- **Login**: 3 options (offline + MS OAuth + AZauth experimental)

---

## Workflow Rules

- **Subagent**: MiniMax-M3 qua `Api.vilao.ai`, làm việc đơn giản, em review
- **Core/logic/UI đẹp**: em trực tiếp code
- **Deliverable**: test thật trước khi giao
- **Repo công ty (hhoangluu/demolish)**: PHẢI hỏi anh trước mọi push
- **VPS ops safety**: destructive commands (pkill -9, kill, delete) phải confirm
- **Editor tools (Phasdo*)**: tool cá nhân, không tự push

---

## Quick Commands

### Build EXE
```bash
cd "D:/2026WORK/Campipi/phase1-app"
npm run package:dir
```

### Copy to Desktop
```bash
taskkill /F /IM "MCPubg Launcher.exe" 2>/dev/null
sleep 1
rm -rf "C:/Users/ADMIN/Desktop/MCPubg-Launcher-v0.2.0-portable"
cp -r "D:/2026WORK/Campipi/phase1-app/release/win-unpacked" "C:/Users/ADMIN/Desktop/MCPubg-Launcher-v0.2.0-portable"
```

### Test
```bash
cd "D:/2026WORK/Campipi/phase1-app"
npm test
```

### SSH VPS
```bash
ssh vps
```

### VPS MC Server start
```bash
cd /home/long/minecraft-server && nohup java @user_jvm_args.txt @libraries/net/minecraftforge/forge/1.20.1-47.4.0/unix_args.txt nogui > logs/latest.log 2>&1 &
```

### VPS Cloudflare Tunnel start
```bash
sudo nohup /usr/local/bin/cloudflared --config /etc/cloudflared/config-mcpubg.yml --origincert /etc/cloudflared/cert.pem tunnel run mcpubg > /tmp/cloudflared.log 2>&1 &
```

---

## Pending Questions

1. **VPS provider**: Anh mua ở đâu? (Em cần IP + ports)
2. **FRP dashboard**: Có bật web UI không? (port 7500)
3. **Encryption + compression**: Bật không?
4. **Mod update hosting**: R2 hay GitHub Releases? (Sau FRP có thể dùng VPS mới)
5. **Cloudflare Tunnel backup**: Giữ 1 tuần rồi xóa, hay xóa luôn?
