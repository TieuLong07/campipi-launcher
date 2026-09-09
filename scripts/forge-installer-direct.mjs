// Run the official Forge 1.20.1-47.4.10 installer headlessly with Java, the
// canonical way Forge ships. We do NOT modify libraries afterwards; XMCL will
// discover the resulting version JSON + jar.
import { mkdir, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { setTimeout as wait } from 'node:timers/promises';

const root = process.cwd() + '/.runtime/clean';
const installer = root + '/libraries/net/minecraftforge/forge/1.20.1-47.4.10/forge-1.20.1-47.4.10-installer.jar';
const java = 'C:/Program Files/Microsoft/jdk-17.0.20.101-hotspot/bin/java.exe';
await mkdir(root + '/logs', { recursive: true });
const out = createWriteStream(root + '/logs/forge-installer.log');

const child = spawn(java, ['-jar', installer, '--installClient', root], { stdio: ['ignore', 'pipe', 'pipe'] });
child.stdout.pipe(out); child.stderr.pipe(out);
const code = await new Promise(r => child.on('close', r));
console.log('forge installer exit', code);
await writeFile(root + '/logs/forge-installer.exit.json', JSON.stringify({code,when:new Date().toISOString()}));
const target = root + '/libraries/net/minecraftforge/forge/1.20.1-47.4.10/forge-1.20.1-47.4.10.jar';
try { console.log('forge jar', target, (await stat(target)).size); }
catch { console.log('forge jar missing'); }
