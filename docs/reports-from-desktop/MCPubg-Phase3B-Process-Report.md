# Phase 3B + 3A-v2 Report

**Date**: 2026-09-08
**Goal**: Spawn Java 17 with the exact Forge command (XMCL/PrismLauncher
convention), stream log to the UI, kill cleanly.

## Test results

- **28/28** all tests pass (12 account + 10 forge + 2 launcher + 4 adapter)
- **TypeScript clean** in both `tsconfig.electron.json` and `tsconfig.json`
- **Forge launch thật** runs through:
  - `BootstrapLauncher 1.1.2` → `ModLauncher 10.0.9+main.dcd20f30`
  - `fmlearlydisplay` opens the early-display window
  - `MIXIN 0.8.5` (SpongePowered)
  - `GL 4.6` on AMD Radeon Graphics
  - `ModFileParser` discovers mods from the `mods/` dir
  - `JarInJarDependencyLocator` finds 22 dependency mods

  Then JPMS complains about a duplicate `thedarkcolour.kotlinforforge`
  module (Phase 0 known issue: the modpack has a kof jar in `mods/` that
  collides with a kof embedded in one of the Forge libraries' module-info).
  This is the same issue we hit in Phase 0 full-pack test and is
  unrelated to the launch command itself.

## What changed in Phase 3A-v2

`src/main/forge-command.ts` rewritten to read `arguments.jvm` /
`arguments.game` from `version.json` instead of synthesizing them
manually. This is the same pattern used by `@xmcl/core generateArguments`,
MultiMC and PrismLauncher.

Key fixes:
- **OS rule filtering**: respect `rules: [{action: allow|disallow, os: {name, arch}}]`
  in the version JSON. `arch: 'x86'` means 32-bit (not 64-bit).
- **Version inheritance chain**: Forge 1.20.1-47.4.10 inherits from
  vanilla 1.20.1, so we resolve the chain and merge libraries + arguments.
- **Game arg de-dup by --key**: when vanilla + Forge both define the same
  game arg (e.g. `--gameDir`), keep only one. We keep the LAST occurrence
  so the more-derived (Forge) version wins.
- **`${...}` substitution BEFORE rule filtering**: so `${resolution_width}`
  becomes a real integer before `joptsimple` parses it.
- **JPMS module-path**: uses `-p` (shorthand for `--module-path`) exactly
  as the Forge JSON defines it. Contains bootstraplauncher + securejarhandler
  + asm-* + JarJarFileSystems.

## What was new in Phase 3B

`src/main/launcher-manager.ts` (180 dòng):

- `launchInstance({runtimeRoot, version, javaPath, username, uuid, accessToken, userType, xmxMb, xmsMb, onLog, onError})`:
  - Builds the Forge command via `buildForgeCommand`
  - Spawns `java.exe` detached on Windows
  - Streams stdout/stderr line-by-line via `onLog(line)` callback
  - Appends to a `launch.log` file in the runtime dir
  - Tracks the process in `activeHandles` Map<pid, handle>
  - Cleans up natives before launch (calls `cleanNatives`)

- `stop(handle)`: safe kill via `taskkill /T /F` on Windows.
  Belt + suspenders: also force-deletes from `activeHandles` even if
  the 'exit' event doesn't fire (a known race when killing detached
  children).

- `listActive()`: snapshot of running processes for the UI.

## Pivotal discoveries

1. **Forge 1.20.1's main class is plain**, not `-m module/main`:
   `cpw.mods.bootstraplauncher.BootstrapLauncher` (NOT
   `cpw.mods.bootstraplauncher/cpw.mods.bootstraplauncher.BootstrapLauncher`).
2. **`-p` is shorthand for `--module-path`** in Java 9+. Forge JSON uses
   `-p` to keep things compact.
3. **MC `arch: 'x86'` means 32-bit**, not 64-bit. This caught me twice.
4. **Process.arch** in Node returns `'x64'` not `'amd64'` on Windows.
5. **`spawnSync` for `java -version`** because version output goes to
   **stderr**, not stdout.
6. **`taskkill /F` may not fire Node's `'exit'` event** on detached
   children. We must clean up the handle explicitly.
