import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { readdirSync } from 'node:fs';
import { Version, diagnose, generateArguments } from '@xmcl/core';
import { createLaunchOptions } from '../src/engine.mjs';

const state = JSON.parse(await readFile(new URL('../docs/evidence/phase-0/installed.json', import.meta.url), 'utf8'));
console.log('--- diagnose ---');
try { await Version.parse(state.root, state.version); }
catch (e) { console.log('parse warn', e.message); }
const rep = await diagnose(state.version, state.root, {strict: true});
console.log('issues', rep.issues.length);
for (const i of rep.issues.slice(0, 5)) console.log(' -', i);

console.log('--- generateArguments with full pack ---');
const opts = createLaunchOptions({root: state.root, java: state.java, version: state.version});
const args = await generateArguments(opts);
const cpEntryIdx = args.findIndex((a, i) => a === '-cp' || a === '--classpath' || a === '-classpath');
const cp = cpEntryIdx >= 0 ? args[cpEntryIdx+1] : null;
if (cp) {
  const parts = cp.split(';');
  const modJars = parts.filter(p => /[\\/]mods[\\/][^\\/]+\.jar$/i.test(p));
  const modDir = path.join(state.root, 'mods');
  const diskMods = readdirSync(modDir).filter(n => n.endsWith('.jar'));
  const cpModNames = modJars.map(p => path.basename(p));
  const missing = diskMods.filter(n => !cpModNames.includes(n));
  const extra = cpModNames.filter(n => !diskMods.includes(n));
  console.log('classpath entries', parts.length, 'mods on cp', modJars.length);
  console.log('disk mods', diskMods.length, 'cp mod names', cpModNames.length);
  console.log('missing on classpath (count)', missing.length);
  if (missing.length) console.log(' first 5 missing:', missing.slice(0,5));
  console.log('extra on classpath (count)', extra.length);
  if (extra.length) console.log(' first 5 extra:', extra.slice(0,5));
} else {
  console.log('NO -cp entry. last 10 args:', args.slice(-10));
}
console.log('total args', args.length);
console.log('last 5:', args.slice(-5));

