// Headless launch of Forge with full mod pack to capture what Forge actually
// loads. We start the game with --demo + --width 200 --height 200 (tiny window),
// grep stdout for "Loading mod" / "Failed to load mod" / mod id markers, then
// kill the process cleanly. This proves the engine + mods integrate.
import { spawn } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { generateArguments } from '@xmcl/core';
import { createLaunchOptions } from '../src/engine.mjs';

const state = JSON.parse(await readFile(new URL('../docs/evidence/phase-0/installed.json', import.meta.url), 'utf8'));
const logDir = path.join(path.resolve('docs/evidence/phase-0'), 'launch');
await mkdir(logDir, { recursive: true });
const outPath = path.join(logDir, 'forge-stdout.log');
const errPath = path.join(logDir, 'forge-stderr.log');
const out = createWriteStream(outPath);
const err = createWriteStream(errPath);

const opts = createLaunchOptions({ root: state.root, java: state.java, version: state.version });
opts.extraJVMArgs = [
  '-Dforge.logging.console.level=debug',
  '-Dlog4j2.debug=false',
];
const args = await generateArguments(opts);
console.log('args count', args.length, 'first 3', args.slice(0,3), 'last 3', args.slice(-3));

const child = spawn(args[0], args.slice(1), { cwd: state.root, stdio: ['ignore', 'pipe', 'pipe'] });
child.stdout.pipe(out);
child.stderr.pipe(err);
console.log('pid', child.pid);

let killed = false;
const timer = setTimeout(() => {
  if (killed) return;
  killed = true;
  console.log('kill timer 90s, sending SIGTERM');
  try { child.kill('SIGTERM'); } catch {}
  setTimeout(() => { try { child.kill('SIGKILL'); } catch {} }, 5000);
}, 90000);

child.on('close', async (code, signal) => {
  clearTimeout(timer);
  await new Promise(r => out.end(r));
  await new Promise(r => err.end(r));
  console.log('forge exit code', code, 'signal', signal);
  const fullOut = await readFile(outPath, 'utf8').catch(() => '');
  await writeFile(path.join(logDir, 'forge-exit.json'), JSON.stringify({code, signal, stdoutBytes: fullOut.length, endedAt: new Date().toISOString()}, null, 2));
});
