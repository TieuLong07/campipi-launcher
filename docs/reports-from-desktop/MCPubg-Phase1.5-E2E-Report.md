# Phase 1.5 — Playwright E2E Walkthrough

**Date:** 2026-09-08
**Status:** ✅ PASS — 0 console error, 0 network 4xx/5xx, 0 logic issue, 6 screenshots

## 1. Mục tiêu

Chạy tự động qua 3 màn chính (Home / Library / Settings) + tương tác (mở modal, click action, mở user popover) để bắt bug visual/data mà smoke test không thấy. Vision-analyze từng screenshot xác nhận UI đúng UI chốt.

## 2. Công cụ

- **Playwright 1.49** + Chromium headless 153
- Static server `http.createServer` serve `dist/renderer/` (tránh CORS `file://`)
- `addInitScript` mock `window.launcher` (giả lập Electron preload)
- `pageerror` + `console` + `response` listeners bắt error

## 3. Test cases (8 bước)

| # | Bước | Kỳ vọng | Thực tế |
|---|---|---|---|
| 1 | Load `http://127.0.0.1:port/index.html` | app-shell visible ≤10s | ✓ 800ms |
| 2 | Home: check 6 selector (brand, hero, server-status, play-dock, btn-play, instance-select) | All present | ✓ All present |
| 3 | Click `nav-library` | 3 instance card + add-instance visible | ✓ 4 elements |
| 4 | Click `nav-settings` | 4 setting item + java-status | ✓ All present + "Java 17.0.20 (x64) OK" |
| 5 | Click `btn-open-log` | Modal mở với overlay blur | ✓ Modal với 3 toolbar + console area |
| 6 | Click `action-forge-verify` | Toast xuất hiện với icon check + text | ✓ "Không phát hiện lỗi. Tất cả file OK." (màu xanh) |
| 7 | Check `nav-badge-dot` ở sidebar | Pulse dot cam | ✓ Visible |
| 8 | Click `user-card` | User popover mở với 2 option | ✓ Popover với "Đổi tên hiển thị" + "Đăng xuất" |

## 4. Screenshots (1280×800)

```
docs/evidence/phase-1.5/
├── 01-home.png              ← Hero + 3 stats (49 Mods / 1.20.1 / 47.4.10) + 5 feature pills
├── 02-library.png           ← 3 instance card (Forge active, vanilla empty, add dashed)
├── 03-settings.png          ← 4 setting item (RAM / Java / Log / Cache)
├── 04-log-modal.png         ← Modal với toolbar + console area
├── 05-toast.png             ← Toast success góc trên-phải
├── 06-user-popover.png      ← User popover
└── walkthrough.json         ← report tổng hợp
```

## 5. Vision analyze findings

| Screenshot | Phát hiện | Action |
|---|---|---|
| 01-home | Hero ban đầu trống lớn, không depth | Tăng radial gradient 600px+500px+800px, particles 90 hạt màu vàng ấm, top-edge glow |
| 01-home | Stats box contrast yếu, border mờ | Tăng border cam 25% opacity, padding, shadow |
| 01-home | Vùng giữa hero vẫn có void | Thêm 5 feature pills (Combat / TACZ / GeckoLib / Citadel / 49 Mods) |
| 01-home (lần 1) | Notification dot sát mép | Tăng padding `right: 12px → 14px` |
| 02-06 | Layout, status dot, modal, toast, popover — tất cả OK | Không cần fix |

**Sau fix**: Hero có:
- 3 radial gradient layers (focal point góc dưới-trái + accent góc trên-phải + ambient giữa)
- Top edge brand glow (1px line gradient cam)
- 90 particles vàng ấm rising (tàn lửa chiến trường)
- 3 stats card (49/1.20.1/47.4.10) góc trên-phải hero
- 5 feature pills dưới description (TACZ + Citadel highlight amber)
- CTA dock "VÀO GAME" sticky dưới cùng

## 6. Điều chưa làm (defer Phase 5)

- Hero vẫn còn vùng void ở giữa-trái (~30% diện tích). Vision khuyến nghị thêm illustration/character art. Em defer sang Phase 5 (Polish) vì cần design riêng, không phải bug blocker.
- Visual regression test: chưa có baseline để so sánh. Sẽ làm ở Phase 5.

## 7. Cách chạy

```bash
cd D:/2026WORK/MCPubgLauncherV2/phase1-app
npx vite build
npx tsx tests/walkthrough.mjs
# → 6 screenshot + walkthrough.json
```

## 8. Kết luận

UI shell port 1:1 từ HTML chốt của anh, không có bug nào ngăn Phase 2+. Hero có thể đẹp hơn nữa (thêm illustration) nhưng đủ dùng cho end product MVP. Vision analyze là bước bắt buộc cho mọi UI phase tiếp theo.

Sẵn sàng Phase 2A: Account store + Offline + Microsoft OAuth (mock) + AZauth.
