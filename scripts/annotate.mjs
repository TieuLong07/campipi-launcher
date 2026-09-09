import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('.runtime/clean');
const java = 'C:/Program Files/Microsoft/jdk-17.0.20.101-hotspot/bin/java.exe';
const version = '1.20.1-forge-47.4.10';
const evidence = path.resolve('docs/evidence/phase-0');
await mkdir(evidence, { recursive: true });
const installed = JSON.parse(await readFile(path.join(evidence, 'installed.json'), 'utf8'));
installed.method = 'forge-installer-direct + 49 mods from mods.zip';
installed.mods = { count: 49, source: 'D:/2026WORK/MCPubg/mods.zip' };
await writeFile(path.join(evidence, 'installed.json'), JSON.stringify(installed, null, 2));
console.log('updated installed.json', installed);
