import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Version, generateArguments, diagnose } from '@xmcl/core';
import { createLaunchOptions } from '../src/engine.mjs';

test('official clean Forge install is healthy and command excludes mod injection', async () => {
  const state = JSON.parse(await readFile(new URL('../docs/evidence/phase-0/installed.json', import.meta.url), 'utf8'));
  await Version.parse(state.root, state.version);
  const report = await diagnose(state.version, state.root, {strict: true});
  assert.equal(report.issues.length, 0, JSON.stringify(report.issues));
  const allArgs = await generateArguments(createLaunchOptions({root: state.root, java: state.java, version: state.version}));
  assert.ok(allArgs.includes('cpw.mods.bootstraplauncher.BootstrapLauncher'), 'mainClass present');
  assert.ok(allArgs.includes('--demo'), 'demo flag present');
  // We do NOT inject any mod jar on the classpath; Forge/MC discover mods at runtime.
  // The runtime is allowed to reference 'mods' as a string somewhere harmless, but no path like "...\\mods\\*.jar" should appear.
  const modPathHits = allArgs.filter(a => /(?:^|[\\/])mods[\\/][^\\/]+\.jar$/i.test(a));
  if (modPathHits.length) console.error('mod path hits', modPathHits);
  assert.equal(modPathHits.length, 0, 'no mods jars on classpath');
  const tlauncherHits = allArgs.filter(a => a.toLowerCase().includes('tlauncher'));
  if (tlauncherHits.length) console.error('tlauncher hits', tlauncherHits);
  assert.equal(tlauncherHits.length, 0, 'no TLauncher references');
});
