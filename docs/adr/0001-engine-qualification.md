# Phase 0 — Engine decision and evidence

User approved fresh start and Electron/React direction. This directory is currently an engine qualification spike, NOT a completed desktop launcher. Core/UI are implemented directly by Hermes; simple audit tasks go to MiniMax-M3 via Api.vilao.ai and are independently reviewed.

## Source and scope
- No old launch command, libraries or Java module hacks are reused.
- Local demo-mode testing only; Microsoft auth/entitlement is not implemented yet.
- LAN VPS unavailable while user is away; user explicitly deferred all SSH/server work. No server-join acceptance claims.
- Existing pack ZIP has 49 JARs. Independent SHA256 comparison confirms only mcpubg-0.0.1.jar differs from old standalone instance; no claim which build is correct. ZIP is used as one coherent local qualification input, not published distribution.
- Old profile cam/mods is currently empty. Original files stay untouched.

## Engine provenance
Npm's current @xmcl/core and installer repository now points to Voxelum/x-minecraft-launcher, MIT, not archived. Old standalone core repo is archived.

Initial current-package attempt failed reproducibly:
1. @xmcl/installer 6.3.3 + @xmcl/core 2.16.1 fails npm install because @xmcl/unzip 2.2.0 publishes workspace:^* dependency.
2. Overriding dependency to @xmcl/yauzl 2.10.0 lets install finish but import fails: @xmcl/unzip main points to missing index.ts.
3. Temporary spike baseline uses @xmcl/core 2.15.1 + @xmcl/installer 6.1.2, whose imports work. Its original undici 7.2.3 has audit advisories; explicit compatible-major override undici 7.29.1 yields npm audit 0 vulnerabilities at execution time. This is a pinned qualification candidate, not final endorsement.
4. Lockfile committed/published only after review; no git remote or external publish created here.

## Commands
- npm ci --ignore-scripts
- npm test
- npm audit --omit=dev
- npm run spike:install

Install target: .runtime/clean (new isolated folder). Existing system Microsoft JDK17 was version-checked; bundled runtime installation is not implemented yet. Vanilla/Forge fetched through official metadata. Forge installer SHA1 is checked against HTTPS official checksum; SHA1 here is compatibility verification, not signed release authentication.

Evidence: docs/evidence/phase-0/install.jsonl and installed.json after a successful installation. A passing option/checksum unit test does NOT establish working Forge/full pack.

## Pending gates
- Clean official install complete.
- Launch vanilla/Forge demo and visually verify render.
- Load full local pack including KotlinForForge, verify required IDs and errors.
- User data/gun pack/config completeness review.
- Product runtime downloader, account system, Electron UI, pack updater/security implementation.
- Figma approval before product UI, unless user explicitly delegates visual design.
- Server join deferred by user.
