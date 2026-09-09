/**
 * Test forge-command builder against the real Phase-0 runtime install.
 * Verifies: Java detection, module-path/-cp split, modlauncher on -cp,
 * LAUNCHER_VERSION env, --module-path -m mainClass syntax.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, statSync, readdirSync } from 'node:fs';
import { buildForgeCommand, detectJava17, cleanNatives } from '../main/forge-command.ts';

const RUNTIME = 'D:/2026WORK/Campipi/.runtime/clean';
const VERSION = '1.20.1-forge-47.4.10';
const JAVA = 'C:/Program Files/Microsoft/jdk-17.0.20.101-hotspot/bin/java.exe';

test('detectJava17 finds Microsoft JDK 17', () => {
  const j = detectJava17();
  console.log('  found:', j.source, j.version, j.path);
  assert.ok(j.source !== 'path', 'Should find a specific JDK, not fall back to PATH');
  assert.ok(j.path.length > 5, 'Path too short');
  assert.ok(j.path.endsWith('java.exe') || j.path.endsWith('java'), `Bad path: ${j.path}`);
  assert.match(j.version, /^17(\.\d+)?$/, `Expected 17.x, got ${j.version}`);
});

test('runtime install has Forge client jar', () => {
  const jar = `${RUNTIME}/versions/${VERSION}/${VERSION}-client.jar`;
  assert.ok(existsSync(jar), `Missing: ${jar}`);
  const size = statSync(jar).size;
  assert.ok(size > 4_000_000, `Forge client too small: ${size}`);
});

test('runtime install has at least 40 mods', () => {
  const mods = readdirSync(`${RUNTIME}/mods`).filter((f) => f.endsWith('.jar'));
  assert.ok(mods.length >= 40, `Only ${mods.length} mods found`);
  console.log('  mods:', mods.length);
});

test('buildForgeCommand produces correct argv structure', () => {
  const built = buildForgeCommand({
    runtimeRoot: RUNTIME,
    version: VERSION,
    javaPath: JAVA,
    username: 'TestPlayer',
    uuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    accessToken: 'fake-token',
    xmxMb: 4096,
    xmsMb: 2048,
    userType: 'offline',
  });

  // argv[0] must be javaPath
  assert.equal(built.argv[0], JAVA, 'argv[0] is not javaPath');
  // Has Xmx + Xms
  assert.ok(built.argv.includes('-Xmx4096M'), 'missing -Xmx4096M');
  assert.ok(built.argv.includes('-Xms2048M'), 'missing -Xms2048M');
  // Forge 1.20.1+ uses shorthand -p (== --module-path) per MultiMC/PrismLauncher
  // convention. We read jvm args from version.json which has -p.
  assert.ok(built.argv.includes('-p'), 'missing -p flag');
  assert.ok(built.argv.includes('-cp'), 'missing -cp');
  // Forge 1.20.1's main class is plain class name, NOT -m module/main form.
  assert.ok(!built.argv.includes('-m'), 'Should not use -m; main class is plain class name');
  const cpIdx = built.argv.indexOf('-cp');
  const mainClass = built.argv[built.argv.lastIndexOf('cpw.mods.bootstraplauncher.BootstrapLauncher')];
  assert.equal(mainClass, 'cpw.mods.bootstraplauncher.BootstrapLauncher', `Bad main class: ${mainClass}`);
  // MultiMC/Prism conventions: -DignoreList, -DmergeModules, -DlibraryDirectory
  assert.ok(built.argv.some((a) => a.startsWith('-DignoreList=')), 'missing -DignoreList');
  assert.ok(built.argv.some((a) => a.startsWith('-DmergeModules=')), 'missing -DmergeModules');
  assert.ok(built.argv.some((a) => a.startsWith('-DlibraryDirectory=')), 'missing -DlibraryDirectory');
  // Has --launchTarget forgeclient
  const ltIdx = built.argv.indexOf('--launchTarget');
  assert.equal(built.argv[ltIdx + 1], 'forgeclient');
  // Has --username + --uuid + --accessToken
  assert.ok(built.argv.includes('--username'), 'missing --username');
  assert.ok(built.argv.includes('TestPlayer'), 'missing TestPlayer');
  assert.ok(built.argv.includes('--uuid'), 'missing --uuid');
  assert.ok(built.argv.includes('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'), 'missing uuid value');
  assert.ok(built.argv.includes('--accessToken'), 'missing --accessToken');
  assert.ok(built.argv.includes('fake-token'), 'missing token value');
  assert.ok(built.argv.includes('--userType'), 'missing --userType');
  // For offline userType, Forge 1.20+ uses 'legacy' in the resolved --userType arg
  assert.ok(built.argv.includes('legacy'), 'missing legacy userType value (Forge convention)');

  // LAUNCHER_VERSION env set
  assert.equal(built.env['LAUNCHER_VERSION'], VERSION);
  // JAVA_TOOL_OPTIONS cleared (otherwise it'd interfere)
  assert.equal(built.env['JAVA_TOOL_OPTIONS'], '');

  // cwd is gameDir (default = runtimeRoot)
  assert.equal(built.cwd, RUNTIME);
});

test('all Forge runtime jars are on -cp (legacy mode)', () => {
  const built = buildForgeCommand({
    runtimeRoot: RUNTIME, version: VERSION, javaPath: JAVA,
    username: 'X', uuid: 'u', accessToken: 't', xmxMb: 4096, xmsMb: 2048, userType: 'offline',
  });
  const cpIdx = built.argv.indexOf('-cp');
  assert.ok(cpIdx > 0, 'missing -cp');
  const cpStr = built.argv[cpIdx + 1];
  // All Forge runtime jars must be in -cp
  for (const jarName of ['modlauncher', 'bootstraplauncher', 'securejarhandler', 'eventbus', 'fmlloader', 'fmlearlydisplay']) {
    assert.ok(new RegExp(jarName, 'i').test(cpStr), `${jarName} missing from -cp`);
  }
  // And mods too
  for (const mod of ['mcpubg-0.0.1', 'citadel', 'geckolib']) {
    assert.ok(new RegExp(mod, 'i').test(cpStr), `mod ${mod} missing from -cp`);
  }
});

test('--add-opens present (cpw.mods.securejarhandler)', () => {
  const built = buildForgeCommand({
    runtimeRoot: RUNTIME, version: VERSION, javaPath: JAVA,
    username: 'X', uuid: 'u', accessToken: 't', xmxMb: 4096, xmsMb: 2048, userType: 'offline',
  });
  // Forge 1.20.1 version.json ships --add-opens as a STANDALONE flag
  // (followed by its value as the next argv item), not as --add-opens=...
  // We read these from version.json exactly, so we expect to see at least 2 pairs.
  const flags = built.argv.filter((a) => a === '--add-opens');
  const values = built.argv.filter((a) => a.includes('=cpw.mods.securejarhandler'));
  assert.ok(flags.length >= 2, `Only ${flags.length} --add-opens flags; expected >= 2`);
  assert.ok(values.length >= 2, `Only ${values.length} securejarhandler add-opens values`);
});

test('native paths set correctly', () => {
  const built = buildForgeCommand({
    runtimeRoot: RUNTIME, version: VERSION, javaPath: JAVA,
    username: 'X', uuid: 'u', accessToken: 't', xmxMb: 4096, xmsMb: 2048, userType: 'offline',
  });
  // In Phase 3A v2 we read jvm args from version.json, which sets:
  //   -Djava.library.path=${natives_directory}
  //   -Djna.tmpdir=${natives_directory}
  //   -Dorg.lwjgl.system.SharedLibraryExtractPath=${natives_directory}
  //   -Dio.netty.native.workdir=${natives_directory}
  // (vanilla 1.20.1 ships these 4 as separate args; substituted via gameVars.)
  const fs = built.argv.filter((a) => a.startsWith('-D') && (a.includes('library.path') || a.includes('jna.tmpdir') || a.includes('lwjgl') || a.includes('netty')));
  assert.ok(fs.length >= 4, `Expected 4 -D natives paths, got ${fs.length}: ${fs.join(', ')}`);
  for (const a of fs) {
    assert.match(a, /natives/, `Bad path: ${a}`);
  }
});

test('xmx/xms is customisable from opts', () => {
  const built = buildForgeCommand({
    runtimeRoot: RUNTIME, version: VERSION, javaPath: JAVA,
    username: 'X', uuid: 'u', accessToken: 't', xmxMb: 8192, xmsMb: 4096, userType: 'offline',
  });
  assert.ok(built.argv.includes('-Xmx8192M'));
  assert.ok(built.argv.includes('-Xms4096M'));
});

test('userType msa mapping (microsoft → msa in --userType arg)', () => {
  // Forge 1.20+ uses 'msa' (Microsoft account) and 'legacy' (offline) for --userType,
  // per the vanilla MC convention. We expose the high-level names but map to the
  // internal Forge-friendly names.
  const built = buildForgeCommand({
    runtimeRoot: RUNTIME, version: VERSION, javaPath: JAVA,
    username: 'X', uuid: 'u', accessToken: 't', xmxMb: 4096, xmsMb: 2048, userType: 'microsoft',
  });
  const utIdx = built.argv.indexOf('--userType');
  assert.equal(built.argv[utIdx + 1], 'msa');
});

test('cleanNatives removes META-INF noise (idempotent)', () => {
  const nativesDir = `${RUNTIME}/versions/${VERSION}/${VERSION}-natives`;
  const before = existsSync(nativesDir);
  if (!before) {
    console.log('  skipping: natives dir does not exist');
    return;
  }
  // First call: removes any noise; second call: 0 removals
  const r1 = cleanNatives(nativesDir);
  const r2 = cleanNatives(nativesDir);
  assert.equal(r2, 0, `Second cleanNatives should be 0, got ${r2}`);
  console.log('  first clean removed', r1, 'noise files');
});
