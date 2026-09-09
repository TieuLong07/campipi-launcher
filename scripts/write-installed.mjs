import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('.runtime/clean');
const java = 'C:/Program Files/Microsoft/jdk-17.0.20.101-hotspot/bin/java.exe';
const version = '1.20.1-forge-47.4.10';
const evidence = path.resolve('docs/evidence/phase-0');
await mkdir(evidence, { recursive: true });
await writeFile(path.join(evidence, 'installed.json'),
  JSON.stringify({root, java, version, installMethod: 'forge-installer-direct'}, null, 2));
console.log('wrote installed.json');
