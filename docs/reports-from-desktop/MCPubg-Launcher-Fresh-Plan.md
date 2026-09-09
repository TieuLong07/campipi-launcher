# MCPubg Launcher Fresh Start — Implementation Plan

**Goal:** Launcher Windows hoàn chỉnh cho cộng đồng MCPubg: cài sạch → đăng nhập → tải đúng pack → vào server, có update/repair/rollback và chẩn đoán lỗi thực sự.

**Architecture:** Desktop UI tách khỏi application services và launch-engine adapter. Manifest đã ký là nguồn sự thật của pack; runtime/instance mới độc lập hoàn toàn với launcher cũ. Dịch vụ phát hành tĩnh trước, không dựng backend tài khoản khi chưa có nhu cầu được duyệt.

**Tech stack đề xuất, CHƯA DUYỆT:** Electron + React + TypeScript, Vite, schema validation, SQLite cho metadata/journal không chứa token, Windows credential storage, Vitest + Playwright Electron, electron-builder. Engine ứng viên XMCL phải qua Phase 0; không chốt phiên bản/thư viện từ search snippet.

**Execution:** Subagent viết code/fix; Hermes review spec, source, UI và test thật. Nếu subagent down phải báo rõ. Chỉ triển khai sau khi anh duyệt scope; mỗi phase có demo/gate và dừng lấy feedback. Đây là product/architecture plan, chưa phải code triển khai. Sau Phase 0, chia các task thành chu kỳ RED → GREEN → regression nhỏ theo engine API thực tế.

## 1. Fresh start có nghĩa gì

- Không xóa, sửa hay migrate bản cũ trong turn lập plan.
- Code mới dự kiến: `D:/2026WORK/MCPubgLauncherV2/` (chỉ tạo sau khi duyệt).
- Runtime mặc định dự kiến: `%LOCALAPPDATA%/MCPubgLauncherV2/`; cho chọn ổ game ở onboarding.
- Bản cũ `C:/Users/ADMIN/mc-pubg-launcher/` và mod server `D:/2026WORK/MCPubg/` giữ nguyên.
- MCPubg BR mod và pack là đầu vào được audit, không rewrite gameplay mod dưới danh nghĩa rewrite launcher.
- Không copy classpath builder, JVM flags thử nghiệm, cache libraries hoặc metadata TLauncher sang dự án mới. Profile cam chỉ là nguồn đối chiếu inventory/khả năng chạy, không phải bộ cài phân phối.
- Không dùng lời báo cũ “48/49 chạy” làm bằng chứng. JAR count không đồng nghĩa loaded mod-ID count. Pack phải có đủ dependency bắt buộc và chơi được.
- Server production/tunnel chưa được kiểm tra live trong plan; mọi deploy hoặc restart sau này cần duyệt phạm vi và tác động.

## 2. Học launcher nào, học cái gì

### TLauncher — luồng vào game đơn giản
Học: chọn profile/account và một CTA cài/chơi dễ hiểu. Không bê màn hình nhiều thông tin, branding, asset, authentication tùy biến hay các bản vá riêng của họ.

### Prism Launcher — isolation và quyền kiểm soát
Nguồn chính thức mô tả instance riêng settings/mods/config, quản lý modpack và mod. Áp dụng: Stable/Test tách biệt, log dễ lấy, Java theo profile, repair không xóa dữ liệu người chơi. Không clone nguyên giao diện kỹ thuật hoặc fork code GPL mà bỏ qua nghĩa vụ license.

### Modrinth App — modpack trở thành sản phẩm
Nguồn chính thức mô tả quản lý, cài, cập nhật mod và chia sẻ pack; help center có repair instance. Áp dụng: pack detail dễ đọc, changelog trước update, nội dung và trạng thái cài rõ ràng. Không suy diễn rằng sản phẩm có bảo đảm transactional update chỉ từ marketing.

### XMCL — tách launch/install/auth/task thành module
Tài liệu core cung cấp các package này và hướng tới Electron. Áp dụng kiến trúc adapter, task progress/cancel, download có kiểm soát. **Cảnh báo đã xác minh GitHub API: repo `Voxelum/minecraft-launcher-core-node` archived=true.** Có thể có hướng bảo trì mới, nhưng chưa xác minh. Phase 0 phải tìm provenance hiện hành và đánh giá trước khi chọn. Không nhầm `@xmcl/core` với package `minecraft-launcher-core` của tác giả khác.

Đây là tham khảo chức năng/tài liệu, chưa cài và benchmark trực tiếp những launcher đó.

## 3. Phạm vi V1: hoàn chỉnh cho MCPubg, không clone toàn bộ TLauncher

### Phải có để gọi là V1 hoàn chỉnh
- Windows x64 trước; matrix Win10/11 được xác nhận bằng máy test có thể truy cập, không mặc định đã test cả hai.
- Onboarding: chọn ổ game, kiểm tra quyền ghi/dung lượng, account, RAM, tải runtime riêng khi cần.
- Cài Minecraft 1.20.1 + Forge version được kiểm chứng với server + Java17 x64 + dependencies/assets/natives từ nguồn phù hợp.
- Một pack chính thức; Stable và Test channel/instance không dùng chung thư mục mods hoặc config.
- Tải có progress byte thật, retry/backoff, cancel; resume khi server hỗ trợ Range, nếu không thì tải lại file đó.
- Microsoft login qua trình duyệt hệ thống; refresh/logout/account switch, lỗi entitlement rõ ràng. Không thu mật khẩu Microsoft, không mượn client ID launcher khác.
- Play điều phối check → repair/update → auth → proxy → launch. Thông báo lỗi có bước khắc phục, không spinner vô hạn.
- Server status, endpoint cấu hình được, tự chọn local port, WSS bridge chạy cùng vòng đời game.
- Pack update có preview/changelog, chỉ tải file đổi, verify, activate an toàn, phục hồi khi lỗi; repair có phân loại managed/user-owned.
- Settings thật: RAM giới hạn theo khả năng máy, Java override được validate, game folder, network, hành vi khi đóng cửa sổ.
- Logs/crash report và export hỗ trợ có redaction + user consent trước upload.
- Installer, app update có xác minh chữ ký, changelog, recovery; uninstall cho giữ dữ liệu game.
- News/changelog đơn giản từ release feed; offline/stale state rõ ràng, không lấy dữ liệu giả lấp chỗ trống.

### Không làm trong V1
- Marketplace tất cả mod, mọi version Minecraft và mọi loader.
- Friends/chat/clan/leaderboard web, anti-cheat riêng, subscription, shop, skin/cape ecosystem riêng.
- Linux/macOS, P2P distribution, binary delta patch, launcher plugin system.
- AZauth/private identity backend tự dựng. Nếu anh cần, phải duyệt scope riêng, bảo vệ danh tính cả phía server; chỉ nhập nickname không phải authentication.
- Discord RPC và skin preview là backlog V1.1, không cản luồng chơi.

Offline play chỉ áp dụng cached instance và chính sách account/server đã duyệt; không thay thế Microsoft entitlement, không hứa nickname vào được online-mode server.

## 4. Chọn stack có điều kiện

### Đề xuất chính: Electron + React + TypeScript
- Hợp workflow Figma của anh, dễ iteration UI/component/state và tự động QA desktop.
- Node có network/filesystem/process ecosystem; UI và backend cùng type contracts.
- Nhược: Chromium tốn RAM/disk; phải đo launcher riêng trước/sau khi mở game. Không hứa EXE nhỏ hoặc nhẹ hơn Qt.
- Renderer sandbox, contextIsolation bật, nodeIntegration tắt, CSP chặt. Preload chỉ expose IPC whitelist có schema; không expose shell/fs tùy ý. News là dữ liệu inert đã sanitize, không cho remote code chạy.

### Phương án thay thế
- PySide6 + QML: hợp nếu ưu tiên footprint hơn web UI; vẫn phải viết engine adapter sạch, không tái sử dụng hacks cũ.
- Tauri: chỉ cân nhắc nếu anh chấp nhận toolchain Rust và yêu cầu footprint khiến lợi ích đáng giá.
- Fork launcher trưởng thành: có thể giảm tự viết core, nhưng phải review license, auth client registration, branding và gánh nặng merge upstream. Không phải mặc định của plan này.

**Gate:** nếu engine ứng viên không có đường bảo trì đáng tin hoặc không launch pack sạch, dừng và trình kết quả để đổi adapter/stack. Không dành các phase sau để che lỗi core bằng UI.

## 5. Kiến trúc và ownership

```text
React renderer
  → typed, validated preload IPC
    → Main application services / task coordinator
      ├─ AccountService → OS credential store
      ├─ RuntimeService → private Java
      ├─ InstallService → engine adapter / official metadata
      ├─ PackService → signed manifest / download cache / journal
      ├─ InstanceService → Stable/Test isolation
      ├─ LaunchService → Java process + lifecycle
      ├─ ProxyService → local TCP → WSS → server TCP
      ├─ DiagnosticsService → sanitized logs/export
      └─ AppUpdateService → signed release/helper
```

Không network/hash/unzip blocking trên UI thread. Main điều phối, tác vụ nặng vào worker/utility process. Không kill process theo tên; single-instance lock + IPC focus cửa sổ cũ. Khi thoát game chỉ cleanup tài nguyên do launcher sở hữu.

Runtime layout dự kiến:
- `runtimes/java17/`, `cache/objects/`, `metadata/state.sqlite`, `logs/`.
- `instances/stable/`, `instances/test/`: mỗi instance có game/user data và pack activation state riêng.
- `staging/`, `transactions/`, `backups/`: kích thước/retention có giới hạn; user xem được dung lượng.
- Credential/token không lưu vào JSON, SQLite, command log hoặc crash bundle. Private signing keys không nằm trong app/repo.

### Trạng thái Play trung thực
`NOT_INSTALLED → CHECKING → DOWNLOADING → VERIFYING → READY → AUTHENTICATING → CONNECTING → STARTING → GAME_RUNNING`, kèm `CANCELLED/FAILED/UPDATE_REQUIRED`.

GAME_RUNNING chỉ có nghĩa game đang chạy. **JOINED_SERVER** cần bằng chứng session join từ log/protocol hoặc tích hợp mod đã duyệt, không suy từ PID sống vài giây. Launcher không giả vờ biết người chơi đã vào trận.

### Proxy không chỉ là port mở
- Bind local TCP trên 127.0.0.1, giữ socket đã bind để tránh race chọn port.
- Readiness: local listener + WSS kết nối + Minecraft status handshake end-to-end; transport up khác server ready.
- Kiểm tra Forge login qua localhost và virtual host/server address thật khi áp dụng.
- Đóng cửa sổ mặc định thu nhỏ tray khi game cần proxy; explicit Exit hỏi tác động.
- WSS mất giữa trận đồng nghĩa TCP session có thể mất. Có backoff và hướng dẫn rejoin, không hứa reconnect transparent để giữ nguyên trận.
- Không bật listener LAN, không tắt TLS verification; xem lại timeout, limits và điều khoản nhà cung cấp tunnel trước public launch.

## 6. Modpack là release artifact có kiểm soát

Manifest contract dự kiến tại `packages/contracts/src/pack-manifest.ts`, schema tại `schemas/pack.schema.json`:
- `schemaVersion`, `packId`, `packVersion`, `channel`, `minecraftVersion`, `forgeVersion`, `javaMajor`, `minLauncherVersion`.
- `files[]`: relative path, source URL/provider project+file ID, size, SHA-256, side(client/server/both), required/optional, managed/default/user-owned policy.
- Inventory dependency: mod IDs/version ranges; duplicate/missing IDs là lỗi, có xử lý nested Jar-in-Jar.
- `compatibility`: server pack/protocol constraint; endpoint do channel metadata tin cậy xác định.
- Signature metadata/key ID, freshness/version chống replay; canonical bytes ký phải được định nghĩa và có test vectors.

### Phát hành
Audit license từng mod/resource/gun pack. Không mặc định được upload nguyên `mods.zip`. Nếu nguồn cấm rehost, dùng download provider/API được phép; không bypass restriction. Java/Minecraft tải từ nguồn chính thức/phù hợp giấy phép. Có notices khi phát hành, review Minecraft usage/EULA.

Cùng một source manifest sinh client/server inventories, nhưng **không ép tất cả mod server vào client**; phụ thuộc side và handshake requirements. Client-only mod không gửi lên dedicated server.

### Update/repair an toàn
1. Lock instance; không update managed runtime/mods khi Java đang sử dụng.
2. Verify metadata/signature/version compatibility trước lập diff; SHA-256 chỉ chứng minh integrity, không thay signature authenticity.
3. Preflight đủ disk cho download, staging và rollback. Tải file đổi vào staging; validate hashes và safe paths.
4. Chặn absolute path, drive prefix, traversal, symlink/junction escape, Windows reserved names, case collisions và zip bomb.
5. Ghi transaction journal; activate bằng chiến lược same-volume rename/pointer đã chứng minh trên Windows. Không gọi nhiều overwrite là atomic.
6. Nếu crash/AV lock ở bất kỳ bước nào: recover journal khi mở lại, hiện trạng thái và cho retry/rollback. Bản trước giữ nguyên tới commit thành công.
7. User data như saves, screenshots, options, keybindings không bị repair overwrite. Config managed có policy rõ; migrate có backup/preview, không blanket copy.
8. Chỉ xóa file managed từ manifest cũ. File lạ hoặc sửa tay báo conflict/quarantine có consent, không tự xóa.
9. Rollback pack không có nghĩa pack cũ còn vào server mới; check compatibility và chặn Join nếu lệch. Không tự rollback world save hoặc hứa đảo ngược world migration.

Channel Stable và Test dùng feed tách biệt. Launcher auto-update và pack update là hai hệ khác nhau; không self-overwrite EXE đang chạy. Release helper ký/xác minh rồi restart sau user consent, recovery nếu app mới không khởi động.

## 7. Roadmap và evidence gates

Tất cả phase đang CHƯA TRIỂN KHAI. Không ghi ngày hứa giao trước khi qua Phase 0 và chốt Figma/auth.

### Phase 0 — Technical proof và khóa phạm vi
**Files:** `docs/adr/0001-stack.md`, `docs/compatibility.md`, `docs/auth-decision.md`, `docs/licenses.md`, `spikes/clean-launch/README.md`, `tests/integration/clean-install.test.ts` (nếu chọn TS).
- [ ] Audit inventory cam/server read-only với consent; xác định exact Forge, required mods/gun packs/config/side, không chốt số 49 từ lời kể.
- [ ] Xác minh maintainers/source/npm provenance/license của engine. Dependency versions khóa sau kiểm thử.
- [ ] Trong thư mục sạch: Java17 → vanilla → Forge trống → full required pack; thu launch args đã redact, logs, required mod IDs.
- [ ] Kiểm tra KotlinForForge theo Forge discovery chuẩn, không append toàn bộ mods vào JVM classpath.
- [ ] Kiểm chứng Microsoft app registration + Minecraft API eligibility và account có entitlement. Không hứa thời gian được duyệt.
- [ ] Kết nối test server trực tiếp và qua WSS; không đổi production nếu chưa xin phép.
**Gate:** bằng chứng title menu, full required mod load và server join thật. Có blocker → báo nguyên nhân và chọn hướng tiếp, không coi partial pack là pass.

### Phase 1 — Figma và UX contract được duyệt
**Files:** `docs/ux/flows.md`, `docs/ux/figma-links.md`, `apps/desktop/src/renderer/styles/tokens.css`, `tests/e2e/onboarding.spec.ts` (UI code sau design approval).
- [ ] Anh design Figma; em cung cấp flow/state/content brief, review feasibility, không tự chốt visual mặc định.
- [ ] Screens: Onboarding/Account, Home, Pack & Updates, Downloads, Settings, Logs & Help.
- [ ] Home tập trung pack art/title/version, server status và một CTA chính. Account ở vị trí nhất quán; không dashboard card dày đặc.
- [ ] Design idle/loading/failure/cancel/offline/update-required, keyboard focus, DPI và cửa sổ nhỏ; SVG icons, tuyệt đối không emoji.
**Gate:** anh duyệt design và clickable UI flow. UI demo phải ghi là demo, chưa gọi launcher hoàn chỉnh.

### Phase 2 — Foundation, account và install thật
**Files:** `apps/desktop/src/main/{ipc,accounts,runtime,install}/`, `apps/desktop/src/preload/index.ts`, `packages/engine-adapter/src/index.ts`, `packages/contracts/src/`, `tests/unit/{ipc,account,runtime}.test.ts`, `tests/integration/install.test.ts`.
- [ ] Single-instance + IPC contract + state persistence + log redaction.
- [ ] Login/cancel/refresh/logout; token OS store, không client secret trong desktop bundle.
- [ ] Preflight path/space/RAM/Java architecture và fresh install; download task retry/cancel/progress.
**Gate:** một người mới chọn folder → đăng nhập → cài pack từ đầu; không cần Python/Node/Java/TLauncher cài sẵn. Test thực sự và dẫn chứng.

### Phase 3 — Play, server join và lifecycle
**Files:** `apps/desktop/src/main/{launch,proxy,server}/`, `tests/integration/proxy.test.ts`, `tests/e2e/play.spec.ts`.
- [ ] Launch orchestration và game args theo metadata chuẩn.
- [ ] Dynamic local port, WSS readiness, protocol-correct status, timeouts.
- [ ] Double-click Play không spawn đôi; close/tray/exit/relaunch có semantics rõ; crash không kẹt nút Play.
**Gate:** đóng/mở launcher, launch game, join Forge server, dùng TACZ và required features trên test server. Chơi trận BR với ít nhất hai người khi có tester; nếu chưa có thì mục đó vẫn pending.

### Phase 4 — Pack update, repair và rollback
**Files:** `packages/pack-manager/src/{manifest,diff,download,transaction,repair}.ts`, `tests/unit/{manifest,diff,paths}.test.ts`, `tests/integration/update-recovery.test.ts`.
- [ ] Manifest validation/signature + inventory checks + managed ownership.
- [ ] Incremental download, journal, crash recovery, rollback và compatibility gate.
- [ ] Publish CLI local dry-run/build/sign/verify; không tự push/upload.
**Gate:** clean install A → update B chỉ file đổi → fail/cancel/corrupt tại các boundary → restart/recover; user data vẫn giữ nguyên, server mismatch bị chặn trước Play.

### Phase 5 — Product polish và support
**Files:** `apps/desktop/src/renderer/pages/{home,pack,downloads,settings,diagnostics}/`, `apps/desktop/src/main/diagnostics/`, `tests/e2e/{settings,diagnostics,offline}.spec.ts`.
- [ ] Settings có persistence thực, accessible navigation, DPI/layout review theo Figma.
- [ ] News/release feed cache có timestamp và stale label; không đòi backend riêng.
- [ ] Crash categories: runtime/missing dependency/disk/network/auth; export redacted report và copy lỗi dễ dùng.
**Gate:** user xử lý được case disk full, server offline, expired auth và lỗi mod mà không cần mở terminal; screenshot mọi trạng thái chính.

### Phase 6 — Release và clean-machine qualification
**Files:** `electron-builder.yml`, `apps/desktop/src/main/app-update/`, `scripts/release/`, `docs/{release,qa-matrix,support}.md`, `tests/integration/app-update.test.ts`.
- [ ] Build installer, notices, signed update artifacts; private key/release credentials lưu ở secret store/CI.
- [ ] Authenticode certificate Windows là dependency riêng có thể tốn phí; app artifact signature không tự thay thế OS publisher identity/SmartScreen reputation.
- [ ] Test new Windows user/máy khác không Java/MC/cache, đường dẫn tiếng Việt và ổ khác.
- [ ] App update khi game chạy phải defer; test lỗi updater/AV file lock/rollback; uninstall giữ game khi chọn.
- [ ] Đo startup, RAM launcher, disk/bandwidth; chỉ công bố số đo từ bản build thật.
**Gate:** installer phát cho người khác và họ tự cài → login → join → update → repair thành công. Nếu chưa có cert/máy test/account approved phải công bố giới hạn beta, không tuyên bố public-ready.

## 8. Quy trình test và giao việc

Mỗi implementation ticket sau stack gate:
1. Ghi input/output, exact file và acceptance test.
2. Subagent viết test fail, chạy xác nhận fail đúng lý do.
3. Implement tối thiểu, chạy focused test rồi regression.
4. Hermes tự đọc diff, chạy test và smoke/e2e, kiểm tra screenshots bằng vision.
5. Lưu evidence vào `docs/evidence/phase-N/`; artifacts gửi anh ở Desktop.
6. Commit local sau review theo policy; không tự push/deploy khi chưa duyệt.

Lệnh dự kiến sau khi các script được triển khai (không phải output đã chạy):
- `npm run typecheck`
- `npm run test:unit`
- `npm run test:integration`
- `npm run test:e2e`
- `npm run build`
- `npm run dist:win`

Test matrix tối thiểu: fresh install, reinstall, existing cache, Unicode/space path, alternate drive, no/wrong Java, interrupted download, no Range, hash mismatch, invalid signature, stale manifest, unsafe path, low disk, write denial, AV lock, expired auth, logout, port conflict, server down, WSS mid-session loss, full required mod discovery, pack A→B→rollback, config conflict, app update, game crash, close/tray/exit, double Play, uninstall preserve data. Không mô phỏng API output để tuyên bố integration pass; fixtures chỉ dùng cho unit/fault-injection có nhãn.

## 9. Blocking decisions, dependencies và capacity

- Anh duyệt: Electron/React đề xuất hay giữ PySide6/QML; Windows-first curated MCPubg V1; cách xác thực cộng đồng mong muốn.
- Anh cung cấp/duyệt Figma trước UI implementation. Phase 0 technical proof không cần chờ visual.
- Microsoft app/Minecraft API access là external gate, không coi có thư viện OAuth là đã xong login.
- Nếu private identity được yêu cầu: phải có server auth handshake không thể bypass bằng client khác; username không phải account. Scope backend mới được estimate riêng.
- Mod redistribution rights và provider rate/API policy có thể chặn publish, không giải quyết bằng upload lại trái quyền.
- Engine XMCL archived là rủi ro thật; cần current-maintained alternative hoặc pinned audited source với kế hoạch security maintenance được anh duyệt.
- Thiếu Windows VM/máy thứ hai/tester hai người/cert signing phải báo rõ. Không thể hứa acceptance gate đã pass chỉ bằng một laptop dev.
- Em có thể tổ chức triển khai, review và test trên môi trường được cấp; không thể bảo đảm thời gian Microsoft approval, publisher reputation hoặc hỗ trợ mọi máy khi chưa test.

## 10. Nguồn tham khảo và mức xác minh

Đối chiếu ngày 2026-09-07. Đây là research cho plan, chưa benchmark launcher.
- https://tlauncher.org/ — search trả nội dung chính thức về one-click versions/Forge/Fabric; dùng làm tham khảo flow, không chứng thực các marketing claims.
- https://prismlauncher.org/ — đọc HTML chính thức: instance/mod/modpack management, Qt và GPL-3.
- https://modrinth.com/app — đọc HTML chính thức: mod management, update và sharing.
- https://support.modrinth.com/en/collections/7804910-modrinth-app — search official help index có repair instance.
- https://xmcl.app/en/core/ — đọc tài liệu trực tiếp: modules launch/install/user/task, Electron target.
- https://xmcl.app/en/core/installer — search official docs: progress task và concurrency.
- https://api.github.com/repos/Voxelum/minecraft-launcher-core-node — đọc API trực tiếp: archived=true, MIT license. Đừng suy rằng tài liệu vẫn online nghĩa là repo còn maintained.
- https://minecraft-launcher-lib.readthedocs.io/en/stable/tutorial/microsoft_login.html — search docs nêu AzureAppNotPermitted/Minecraft API permission; fetch trực tiếp bị 403, phải xác minh lại quy trình Microsoft hiện hành ở Phase 0.

**Status cuối:** Plan chờ anh duyệt. Chưa tạo app/repo, chưa đổi server, chưa cài dependency, chưa chạy integration hoặc build nào cho bản fresh.

## 9. UI chốt (anh duyệt 2026-09-07)

- **Bản chuẩn**: `C:\Users\ADMIN\Downloads\mcpubg_launcher_ui_minimal.html` (54.7 KB, single file HTML/CSS/JS, Plus Jakarta Sans + JetBrains Mono, warm terracotta `#e0532c`)
- **Mirror Desktop**: `C:\Users\ADMIN\Desktop\MCPubg-Launcher-UI.html`
- **Trong repo**: `D:/2026WORK/MCPubgLauncherV2/ui-mockup/v2.html`
- **Triết lý**: 3 tab (Chơi ngay / Bản cài đặt / Cấu hình), Hero 1 khối lớn có ambient canvas, dock Play ở dưới cùng cố định, mỗi tab tối đa 1-3 card. Không modal phụ (chỉ modal Log). Toast 4 loại có sẵn. Sidebar dọc 230px. Update badge dot ở nav-item "Bản cài đặt". Status badge ở trong card-details (ready / need-download / broken / empty) — không ở góc.
- **Settings 4 hàng**: RAM Max slider / Phiên bản Java / Xem log (mở modal) / Dọn cache.
- **Cấu trúc file**: 1 file duy nhất, không phụ thuộc framework. Phase 1 sẽ dùng file này làm static skeleton trong `public/`, mỗi DOM node gắn `data-testid` để Playwright test ổn định; component hoá từng phần (Hero / Dock / Sidebar / InstanceCard / SettingItem / Toast) khi chuyển sang React.
- **Đã cố ý không thêm**: modal accounts (offline + MS + AZauth), modal add server, nút "Mở folder" ở dock — anh muốn Settings gọn 4 hàng, các thứ phụ chưa cần ở v1.
- **Khi nào cần thêm accounts/add server**: Phase 2 (Account+bộ cài) mới mở modal — Phase 1 chỉ làm app shell + render đúng UI chốt này.
