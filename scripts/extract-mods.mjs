// Extract 49 mod jars from mods.zip into .runtime/clean/mods/.
// Source of truth: ZIP entries. Existing mods are wiped first.
import { mkdir, rm } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';

const root = process.cwd() + '/.runtime/clean';
const mods = path.join(root, 'mods');
const src = 'D:/2026WORK/MCPubg/mods.zip';
await rm(mods, {recursive: true, force: true});
await mkdir(mods, {recursive: true});

const yauzl = (await import('@xmcl/yauzl')).default;
const zip = await new Promise((res, rej) => yauzl.open(src, {lazyEntries: true}, (e, z) => e ? rej(e) : res(z)));

let count = 0;
const failures = [];
await new Promise((resolveAll) => {
  zip.on('entry', (entry) => {
    if (!entry.fileName.endsWith('.jar')) { zip.readEntry(); return; }
    const name = path.basename(entry.fileName);
    zip.openReadStream(entry, (e, rs) => {
      if (e) { failures.push({name, err: e.message}); zip.readEntry(); return; }
      const ws = createWriteStream(path.join(mods, name));
      pipeline(rs, ws).then(() => { count++; if (count % 10 === 0) console.log('extracted', count, '...'); zip.readEntry(); }).catch(e => { failures.push({name, err: e.message}); zip.readEntry(); });
    });
  });
  zip.on('end', () => resolveAll());
  zip.on('error', (e) => { console.error('zip error', e); resolveAll(); });
  zip.readEntry();
});
await new Promise(r => setTimeout(r, 300));
console.log('done, extracted', count, 'failures', failures.length);
if (failures.length) for (const f of failures) console.error('FAIL', f);
