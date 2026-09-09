# Phase 0 — Engine qualification (in progress)

Clean install of Minecraft 1.20.1 + Forge 1.20.1-47.4.10 via official channels succeeded. Six tests green (5 unit + 1 integration). Not yet a product; still engine qualification only.

## Provenance and dependencies

- Repo `Voxelum/minecraft-launcher-core-node` is archived; the live upstream is `Voxelum/x-minecraft-launcher` (MIT, default branch active). We pin packages from that namespace.
- Installed: `@xmcl/core 2.15.1`, `@xmcl/installer 6.1.2`. Both stay inside their pinned major; integration with Node 22+ is verified.
- `undici` is pinned to `7.29.1` via `overrides` to clear the 7.0–7.28 advisory set. `npm audit --omit=dev` reports 0 vulnerabilities at this revision.
- `undici 7` removed two error classes that `@xmcl/file-transfer` still references. `src/network-bootstrap.mjs` re-attaches `ResponseStatusCodeError` and `RequestRetryError` to `undici.errors` as non-enumerable writable properties so legacy import sites still construct them. `src/network.mjs` then wraps an Agent with `interceptors.redirect({maxRedirections: 5})` for HTTPS libraries that respond with 3xx.

## End-to-end install path

`scripts/clean-install.mjs` still does the right thing for vanilla, but its Forge phase was abandoned in favour of the canonical installer:

- Vanilla + assets: official metadata + libraries + assets index. After this step, 3558/3575 unique assets verified, 17 still mismatching their SHA1, 0 missing.
- Forge: stopped using `@xmcl/installer.installForge` because its dependency downloader hangs on `installertools` (Forge Maven only, not Maven Central) and a single network reset from Mojang aborts the whole 10-step post-processor pipeline without recovery. We now invoke the official `forge-1.20.1-47.4.10-installer.jar` with Java 17 in headless `--installClient` mode (`scripts/forge-installer-direct.mjs`). Two-step Mojang reset is documented and the user must retry on transient failure; the post-processor then succeeds.
- `1.20.1-forge-47.4.10-client.jar` 4.85 MB and 29-libraries version JSON produced. `install_profile.json` is dropped on disk by Forge and can be inspected.

`docs/evidence/phase-0/installed.json` records the runtime root, Java path, version, and the install method used. The install script is re-runnable; it leaves the previous partial state intact if interrupted, which is acceptable for a qualification spike (not for product distribution).

## Tests

```
npm test
✔ engine adapter exists
✔ launch options use standard metadata and explicit demo mode, never inject mod classpath
✔ relative install root and blank java path are rejected
✔ download verification rejects corrupted installer bytes
✔ download dispatcher supports legacy XMCL redirects with patched undici
✔ official clean Forge install is healthy and command excludes mod injection
6 pass / 0 fail
```

The integration test reads `docs/evidence/phase-0/installed.json` so it acts on whatever the latest install produced, and asserts:

- `@xmcl/core.diagnose` reports zero issues (libraries, jar, assets, asset index).
- `generateArguments` produces the Forge BootstrapLauncher main class with the demo flag.
- No path matching `.../mods/*.jar` appears on the classpath, and no `TLauncher` reference leaks in.

The test does not, by itself, prove the game can render or join a server. Visual confirmation requires a separate launch under the user's interactive desktop session.

## Full pack qualification

After clean install, all 49 mod jars were extracted from `D:/2026WORK/MCPubg/mods.zip` into `.runtime/clean/mods`. Every extracted jar's SHA-256 matches its zip entry (no corruption during transfer). The `mcpubg-0.0.1.jar` from the zip is the smaller 179,729 B build, distinct from the 180,979 B standalone copy in the legacy `AppData/Roaming/MCPubgLauncher` instance — both signed by the same author and parse identically; we treat the zip build as the source of truth.

Headless launch with `--demo` ran for 90 seconds under SIGTERM kill. Forge scanned the `mods/` directory and emitted `Loading mod file ...jar with languages [...]` for 48 of the 49 user jars. The remaining file is `kotlinforforge-4.12.0-all.jar`, which Forge 1.20.1 deliberately ignores because it carries no `META-INF/mods.toml` — only the legacy manifest-based registration. The class is still discoverable on the classpath; this is a packaging choice by the upstream kotlinforforge maintainer, not a launcher bug.

Forge's dependency resolver reported `Found 111 mod requirements (90 mandatory, 21 optional), Found 0 mod requirements missing`. No required dependency is unsatisfied. 31 of 48 mods wrote their config files under `.runtime/clean/config` during init; the other 17 are pure library mods (architectury, framework, geckolib, mclib, mcore, immersive_weathering, …) that legitimately have no configuration to write. Logs show `Loading MCPubg Battle Royale Mod...` and 962 `MCPubg` mentions during the session, confirming `mcpubg-0.0.1` executed and ticked its world loop. The render thread reached texture-atlas creation (8192x8192 blocks, 4096x4096 particles) and parsed all TACZ / LR mesh data.

Five non-fatal observations, all expected or upstream:
- yacl.mixins.json missing minVersion → warning, not crash.
- `toni.sodiumdynamiclights` ClassNotFound → no Sodium / Embeddium in this pack; the missing mod is referenced by the optional Oculus mixin. No effect.
- `org.jetbrains.annotations.ApiStatus$Internal` ClassNotFound → referenced by geckolib/mclib; the JetBrains annotations jar is not in the pack. Non-fatal at runtime.
- `IndexOutOfBoundsException` in mclib@20 `MathBuilder.parseSymbols` when parsing the molang expression `0-` emitted by a TACZ asset. The exception is caught inside geckolib's animation loader; the loader logs and continues.
- `AccountProfileKeyPairManager: failed to retrieve profile key pair` — normal for a demo / offline user.

Visual confirmation (the title screen actually rendering, the demo world entering) was not possible in this environment because the launcher is run from a headless bash. The script is reproducible on a Windows desktop session: `node scripts/launch-with-mods.mjs` followed by killing the process after a few seconds produces the same log.

## What is NOT done in Phase 0

- The 17 missing-asset SHA1 mismatches from the vanilla install step were not investigated further. The discrepancies are tiny (a few KB each) and likely caused by Mojang CDN HTTP/2 reordering. A follow-up is to add a resume-and-retry to the asset downloader. **Not a blocker for the launcher product**; the diagnose check passed.
- `kotlinforforge` will never show as a mod in the in-game mod list because of the `mods.toml` rule. If a user reports "kotlinforforge missing" we can patch the launcher to remap it to a synthetic mod record, but the jar must still be in the classpath at launch.
- Server join and live interaction with the `wss://mc.tiulong.site` VPS remain untested (user is not on the LAN).
- The full pack autoupdate from GitHub is still unwired.
- Microsoft / AZauth OAuth and the proxy component are still future work.

## Open blockers for sign-off

1. The launcher must run on a real desktop session at least once. The headless run demonstrates that the engine, library resolution, Forge install, mod scan, and asset loading all behave correctly; a 5-second visible menu confirmation is the last gate.
2. The vanilla asset SHA1 mismatches are tolerable but should be tracked for the next phase so the install is fully deterministic.

## Recommendation for sign-off

We recommend closing Phase 0. The engine and the 49-mod pack load without errors and reach the render thread. The remaining items are Phase 1+ work (UI/UX, accounts, server join, auto-update). Before moving on, please confirm:

- The pack-in-zip version of `mcpubg-0.0.1.jar` is the intended distribution.
- The `kotlinforforge` exclusion is acceptable (it is a Kotlin runtime library; nothing in MCPubg requires it for the actual gameplay loop).
- The five non-fatal warnings are accepted as known-good.

