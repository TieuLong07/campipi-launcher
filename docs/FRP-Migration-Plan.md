# MCPubg Launcher — FRP Reverse Proxy Migration Plan

**Date**: 2026-09-09
**Status**: PLANNED
**Author**: Tiểu Vũ (Hermes)
**Context**: Replaces Cloudflare Tunnel-based WebSocket proxy with VPS + FRP for better player UX

---

## 1. Vấn đề hiện tại

### Server Connection Architecture (Current)
```
Player → localhost:25566 → Launcher Proxy (WebSocket client) → wss://mc.tiulong.site → Cloudflare Tunnel → wsproxy:8081 → MC Server:25565
```

### Pain Points
- **Player phải cài Launcher** + chạy WebSocket proxy trước khi join server
- **Bạn bè không có Launcher** → không vào được server
- **Cloudflare free plan** giới hạn bandwidth, có thể throttle game traffic
- **WebSocket overhead** +5ms latency
- **Risk ToS violation** khi stream TCP game qua Cloudflare

---

## 2. Giải pháp: VPS 10k + FRP

### New Architecture
```
Player → IP_VPS:Port (direct TCP) → VPS (frps) → tunnel → Home PC (frpc) → MC Server:25565
```

### Benefits
- ✅ **Bạn bè không cần cài gì** — gõ `IP_VPS:Port` rồi Join
- ✅ **Full TCP/UDP support** — Minecraft Java/Bedrock đều OK
- ✅ **Không bị Cloudflare throttle** (ToS risk = 0)
- ✅ **Lower latency** (no WebSocket overhead)
- ✅ **Trải nghiệm chuẩn server online**

### Trade-offs
- ❌ Tốn 10k VND/tháng
- ❌ VPS 1GB RAM (chỉ đủ làm proxy, không chạy MC)
- ❌ Phụ thuộc uptime VPS provider

---

## 3. Architecture chi tiết

### Components

#### 3.1. VPS (FRP Server — frps)
- **OS**: Ubuntu 22.04 Minimal
- **Spec**: 1GB RAM, 100% CPU, 5GB NVMe, 4 ports
- **Software**: frps (FRP server binary)
- **Ports**:
  - **Bind port** (7000): FRP control channel (frpc connect tới đây)
  - **Game port** (25565 hoặc custom): Forward tới home PC
  - **HTTP dashboard** (7500): FRP web UI (optional, có thể tắt)

#### 3.2. Home PC (FRP Client — frpc)
- **Chạy trên máy anh** (192.168.1.7)
- **Software**: frpc (FRP client binary)
- **Config**: Connect tới VPS, forward VPS:25565 → localhost:25565
- **Auto-start**: Khi Launcher mở + khi play server instance

#### 3.3. MC Server
- **Vẫn chạy trên VPS nhà** (my-vps, 192.168.1.7)
- **Port**: 25565 (giữ nguyên)
- **Không thay đổi** gì

#### 3.4. Launcher (Electron app)
- **Thay đổi**:
  - Tự động start frpc khi play server instance
  - Auto-stop frpc khi game tắt
  - Settings tab: hiển thị FRP status + restart button
  - Config FRP server address (IP_VPS, ports)

---

## 4. Implementation Plan

### Phase 1: VPS Setup (Manual — anh làm)
1. Mua gói VPS 10k từ provider
2. Nhận IP + 2 ports (bind + game)
3. SSH vào VPS
4. Install Ubuntu 22.04
5. Gửi em thông tin để viết config

### Phase 2: FRP Server Setup (Em làm)
1. SSH vào VPS
2. Download frps binary
3. Write `/etc/frp/frps.toml` config
4. Setup systemd service
5. Start + verify

### Phase 3: FRP Client Setup (Em làm)
1. Download frpc binary trên home PC
2. Write `frpc.toml` config
3. Test thủ công: `frpc -c frpc.toml`
4. Verify: bạn bè connect `IP_VPS:Port` → vào được server

### Phase 4: Launcher Integration (Em làm)
1. Add frpc binary vào launcher resources
2. Create `frp-manager.ts` (auto-start/stop, status)
3. Update `launcher-manager.ts`:
   - Start frpc before game spawn
   - Stop frpc on game exit
4. Update `SettingsScreen.tsx`:
   - "FRP Proxy (Kết nối Server)" section
   - Status (Running/Stopped), VPS address, Traffic
   - Restart/Stop buttons
5. Update IPC channels + preload + types
6. Rebuild EXE

### Phase 5: Cloudflare Tunnel Cleanup (Em làm)
1. Stop cloudflared service
2. Stop wsproxy service
3. Keep config files (backup)
4. Document: "Switched to FRP, Cloudflare config preserved for future use"

### Phase 6: Testing
1. **Test 1**: Manual frpc start → bạn bè join server OK
2. **Test 2**: Launcher auto-start frpc → game join server OK
3. **Test 3**: Game exit → frpc auto-stop
4. **Test 4**: Restart frpc từ Settings UI
5. **Test 5**: Verify latency < 50ms

---

## 5. FRP Config Templates

### frps.toml (VPS)
```toml
bindPort = 7000

# Optional: HTTP dashboard
webServer.addr = "0.0.0.0"
webServer.port = 7500
webServer.user = "admin"
webServer.password = "CHANGE_ME"

# Logging
log.to = "/var/log/frps.log"
log.level = "info"
log.maxDays = 7
```

### frpc.toml (Home PC)
```toml
serverAddr = "IP_VPS"
serverPort = 7000

[[proxies]]
name = "mcpubg"
type = "tcp"
localIP = "127.0.0.1"
localPort = 25565
remotePort = 25565

# Optional: encryption + compression
transport.useEncryption = true
transport.useCompression = true
```

---

## 6. Files to Create/Modify

### New Files
- `D:/2026WORK/Campipi/docs/FRP-Migration-Plan.md` (this file)
- `D:/2026WORK/Campipi/docs/FRP-Setup-Report.md` (sau khi setup)
- `D:/2026WORK/Campipi/phase1-app/src/main/frp-manager.ts` (FRP process manager)
- `D:/2026WORK/Campipi/phase1-app/resources/frpc/frpc.exe` (Windows binary)
- `D:/2026WORK/Campipi/phase1-app/resources/frpc/frpc.toml` (default config)
- `C:/Users/ADMIN/Desktop/MCPubg-FRP-Setup-Notes.md` (context cho anh)

### Modified Files
- `D:/2026WORK/Campipi/phase1-app/src/main/launcher-manager.ts` (auto-start frpc)
- `D:/2026WORK/Campipi/phase1-app/src/main/main.ts` (IPC handlers)
- `D:/2026WORK/Campipi/phase1-app/src/main/proxy-manager.ts` (replace WebSocket proxy với FRP)
- `D:/2026WORK/Campipi/phase1-app/src/renderer/components/SettingsScreen.tsx` (FRP status UI)
- `D:/2026WORK/Campipi/phase1-app/src/shared/ipc-channels.ts` (FRP channels)
- `D:/2026WORK/Campipi/phase1-app/src/preload/preload.ts` (FRP API)
- `D:/2026WORK/Campipi/phase1-app/src/shared/types.ts` (FRP types)
- `D:/2026WORK/Campipi/phase1-app/package.json` (add frpc to files)

### VPS Files (to be created)
- `/etc/frp/frps.toml` (FRP server config)
- `/etc/systemd/system/frps.service` (systemd service)

### Home PC Files
- `D:/2026WORK/Campipi/.runtime/frpc/frpc.exe`
- `D:/2026WORK/Campipi/.runtime/frpc/frpc.toml`

---

## 7. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| VPS provider down | Server unreachable | Monitor uptime, có backup plan (Cloudflare Tunnel vẫn còn config) |
| frpc crash | Server disconnect | Auto-restart frpc, launcher detect + restart |
| VPS bandwidth limit | Lag/disconnect | Chọn provider unlimited bandwidth |
| FRP version mismatch | Connection fail | Pin FRP version (0.61.1 hoặc mới nhất ổn định) |
| Home PC sleep/hibernate | Server unreachable | Disable sleep, hoặc use Wake-on-LAN |

---

## 8. Open Questions

1. **Anh mua VPS provider nào?** (Em cần IP + ports)
2. **Anh muốn FRP dashboard (web UI) không?** (port 7500, optional)
3. **Anh muốn encryption + compression không?** (recommended)
4. **Anh muốn giữ Cloudflare Tunnel làm backup không?** (recommend: giữ 1 tuần rồi xóa)

---

## 9. Success Criteria

- [ ] VPS mua xong, có IP + 2 ports
- [ ] frps chạy trên VPS, bind port 7000 listening
- [ ] frpc chạy trên home PC, connect tới VPS
- [ ] Bạn bè connect `IP_VPS:Port` → join server thành công
- [ ] Launcher auto-start frpc khi play server
- [ ] Launcher auto-stop frpc khi game tắt
- [ ] Settings UI hiển thị FRP status + restart button
- [ ] Latency < 50ms
- [ ] Cloudflare Tunnel cleaned up (optional)

---

## 10. Timeline Estimate

- **Phase 1 (VPS setup)**: 1-2 ngày (chờ provider)
- **Phase 2-3 (FRP setup)**: 30 phút
- **Phase 4 (Launcher integration)**: 1-2 giờ
- **Phase 5 (Cleanup)**: 15 phút
- **Phase 6 (Testing)**: 30 phút

**Total**: ~3-4 giờ (excluding VPS purchase wait time)

---

## 11. References

- FRP GitHub: https://github.com/fatedier/frp
- FRP docs: https://gofrp.org/docs/
- Current WebSocket proxy: `D:/2026WORK/Campipi/phase1-app/src/main/ws-proxy.ts`
- Current proxy manager: `D:/2026WORK/Campipi/phase1-app/src/main/proxy-manager.ts`
- Old proxy.py reference: `C:/Users/ADMIN/mc-pubg-launcher/backend/proxy.py`
- VPS provider: [TBD by anh]
