# Phase 3A — Forge Command Builder (Java 17 + module-path split)

**Date:** 2026-09-08
**Status:** ✅ DONE — 10/10 forge-command test pass · 30/30 all test pass · TypeScript clean

## 1. Mục tiêu

Port `desktop-launcher-pyside6/references/forge-launch-command.md` từ Python sang TypeScript, đảm bảo tất cả 7 pitfall được handle, test thật trên Phase-0 runtime install.

## 2. Files

| File | LOC | Vai trò |
|---|---|---|
| `src/main/forge-command.ts` | 200 | `detectJava17()` + `buildForgeCommand()` + `cleanNatives()` |
| `tests/forge-command.test.mjs` | 130 | 10 test case (real Phase-0 runtime) |

## 3. 7 Pitfalls đã handle (đúng theo skill)

| # | Pitfall | Cách xử lý |
|---|---|---|
| 1 | Java 21 không có `jdk.nio.zipfs` | `detectJava17()` ưu tiên Microsoft → Adoptium → TLauncher 17 → PATH, từ chối Java 21 |
| 2 | `MethodHandles.Lookup.IMPL_LOOKUP` cần securejarhandler opens | `--add-opens` cho cả `ALL-UNNAMED` VÀ `cpw.mods.securejarhandler` (×6 modules) |
| 3 | module-path vs -cp split | Classify bằng filename: `modlauncher/securejarhandler/bootstraplauncher` → -cp; còn lại → module-path |
| 4 | modlauncher trên -cp KHÔNG PHẢI module-path | `FORGE_LIBS = ['modlauncher', 'securejarhandler', 'bootstraplauncher']` filter |
| 5 | `LAUNCHER_VERSION` env var | `env['LAUNCHER_VERSION'] = opts.version` (set cứng) |
| 6 | Main class dùng `-m module/class` | `-m cpw.mods.bootstraplauncher/cpw.mods.bootstraplauncher.BootstrapLauncher` |
| 7 | Native DLLs | `-Djava.library.path`, `-Djna.tmpdir`, `-Dorg.lwjgl.system.SharedLibraryExtractPath`, `-Dio.netty.native.workdir` |

## 4. Test thật với Phase-0 runtime

```
$ npx tsx --test tests/forge-command.test.mjs
✔ detectJava17 finds Microsoft JDK 17 (162ms)    ← found: microsoft-jdk17 17.0
✔ runtime install has Forge client jar (0.6ms)   ← 4,848,366 bytes
✔ runtime install has at least 40 mods (0.5ms)   ← 49 mods
✔ buildForgeCommand produces correct argv structure (6ms)
✔ modlauncher is on -cp, not --module-path (Pitfall 4) (5ms)
✔ --add-opens is duplicated for ALL-UNNAMED and securejarhandler (Pitfall 2) (5ms)
✔ native paths set correctly (5ms)               ← 4 -Dxxx paths đều point tới natives/
✔ xmx/xms is customisable from opts (5ms)        ← 4096M / 2048M
✔ userType passed through (microsoft vs offline) (5ms)
✔ cleanNatives removes META-INF noise (idempotent) (1ms)
ℹ tests 10
ℹ pass 10
```

## 5. Java detect output (verify từ console log)

```
found: microsoft-jdk17 17.0
  path: C:/Program Files/Microsoft/jdk-17.0.20.101-hotspot/bin/java.exe
  source: microsoft-jdk17
  version: 17.0
```

## 6. argv sample (một phần, output từ probe)

```
argv[0]  = C:/Program Files/Microsoft/jdk-17.0.20.101-hotspot/bin/java.exe
argv[1]  = -Xmx4096M
argv[2]  = -Xms2048M
argv[3]  = --add-opens=java.base/java.util.jar=ALL-UNNAMED
argv[4]  = --add-opens=java.base/java.util.jar=cpw.mods.securejarhandler
...
argv[13] = -Djava.library.path=...\natives
argv[17] = -Dfile.encoding=UTF-8
argv[18] = -Dminecraft.launcher.brand=mcpubg-launcher
argv[19] = -Dminecraft.launcher.version=0.1.0
argv[20] = --module-path  (contains Forge libs WITHOUT modlauncher)
argv[21] = -cp             (contains modlauncher + 49 mods)
argv[22] = -m
argv[23] = cpw.mods.bootstraplauncher/cpw.mods.bootstraplauncher.BootstrapLauncher
argv[24] = --username
argv[25] = TestPlayer
argv[26] = --uuid
argv[27] = aaaaaaaa-...
argv[28] = --accessToken
argv[29] = fake-token
argv[30] = --version
argv[31] = 1.20.1-forge-47.4.10
...
argv[35] = --launchTarget
argv[36] = forgeclient
```

## 7. Pitfalls gặp & đã fix

1. **java -version in ra stderr**: ban đầu dùng `execFileSync` với `stdio: pipe` → `out` empty. Đã chuyển sang `spawnSync` merge stdout + stderr.

2. **Probe regex fail với 17.0.20.1**: regex cũ `/(\d+)\.(\d+)\./` không match version 3 chữ số. Đã fix thành `/(\d+)(?:\.(\d+))?/`.

3. **Native path separator**: test dùng `/` nhưng `join()` trên Windows trả `\`. Đã fix test dùng regex `/natives$/` thay vì exact string.

4. **isModuleJar stub**: function chỉ return `existsSync` — không dùng, em xóa luôn.

5. **spawnSync require trong ESM**: dùng `require('node:child_process')` cast về `typeof import(...)` để TS không complain.

## 8. Còn lại (sang Phase 3B/3C)

- **Phase 3B**: wire thật vào `child_process.spawn` với `DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP` (Windows), stream stdout/stderr qua IPC `launcher:on-log` → React `<LogModal>`.
- **Phase 3C**: embed WebSocket proxy 127.0.0.1:25566 → wss://mc.tiulong.site.
- **Visual verify**: khi build EXE, anh ngồi trước desktop bấm VÀO GAME → MC render → join server thật.

## 9. Cách verify tay

```bash
cd D:/2026WORK/MCPubgLauncherV2/phase1-app
npx tsx --test tests/forge-command.test.mjs
# → 10 pass, in ra argv + native paths
```
