# Phase 4 — Repair / Verify / Cleanup

**Date**: 2026-09-08
**Goal**: Self-healing checks for the runtime install so users can detect
+ fix common problems without external help.

## Test results

- **38/38** all tests pass (was 32/32; added 6 repair tests)
- **TypeScript clean** in both `tsconfig.electron.json` and `tsconfig.json`
- Verified the real Phase-0 runtime install: all 7 checks return `ok`

## What was new in Phase 4

### `src/main/repair.ts` (220 dòng)

`checkRuntime({runtimeRoot, version})` runs 7 checks and returns
`CheckResult[]` for the UI to render:

| Check | What it does | Action if fail |
|---|---|---|
| `version-dir` | `versions/<v>/` exists | "Cài lại" |
| `client-jar` | Forge client jar ≥ 4MB | "Tải lại Forge" |
| `version-json` | version manifest exists | "Cài lại" |
| `mods-dir` | mods dir with ≥ 1 jar | "Cài modpack" |
| `launcher-profiles` | launcher_profiles.json | (auto-generated) |
| `assets-indexes` | assets/indexes/ has ≥ 1 index | (auto-downloaded) |
| `log-rotation` | logs/ has ≤ 20 files | "Xoay vòng" |

Each result has a `fix: {label, action}` payload that the UI uses to
wire a "Repair" button.

### Helpers
- `sha1(path)`: SHA1 hash of a file (used for modpack integrity)
- `cleanNativesDir(nativesDir)`: recursive walk; removes `META-INF/`,
  `MANIFEST.MF`, and any `.dll`/`.dylib`/`.so`/`.jnilib` files that
  Forge sometimes copies in. Now recursive (was flat in v1).
- `rotateLogs(logsDir, keep=10)`: mtime-sort logs, keep newest 10, delete rest.

## Test count breakdown

- 12 account tests
- 10 forge-command tests
- 2 launcher-manager tests
- 4 adapter tests
- 3 smoke tests
- 2 ws-proxy tests
- 2 proxy-manager tests
- 6 repair tests

**= 38 total**
