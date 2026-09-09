import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd() + '/.runtime/clean';
const profile = JSON.parse(await readFile(root + '/versions/1.20.1-forge-47.4.10/install_profile.json', 'utf8'));
console.log('profile keys', Object.keys(profile));
console.log('minecraft', profile.minecraft);
console.log('processors count', profile.processors?.length);
console.log('libraries count', profile.libraries?.length);
console.log('data keys', Object.keys(profile.data||{}));
console.log('---PROCESSORS---');
for (const p of profile.processors || []) {
  console.log('-', p.jar, 'args:', p.args?.slice(0,3), 'cp:', p.classpath?.slice(0,2), 'outputs:', p.outputs);
}
console.log('---DATA sample---');
const d = profile.data || {};
for (const k of Object.keys(d).slice(0,8)) {
  console.log(k, d[k]);
}
