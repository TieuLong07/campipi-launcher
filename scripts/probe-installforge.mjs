import '../src/network-bootstrap.mjs';
import * as installer from '@xmcl/installer';

const t = installer.installForge(
  {mcversion: '1.20.1', version: '47.4.10', installer: {path: 'https://x', sha1: 'a'.repeat(40)}},
  process.cwd(),
  {java: 'java', side: 'client'}
);
console.log('typeof t:', typeof t);
console.log('t is promise:', !!(t && typeof t.then === 'function'));
console.log('t is function:', typeof t === 'function');
console.log('has startAndWait:', !!(t && typeof t.startAndWait === 'function'));
console.log('keys:', t && typeof t === 'object' ? Object.keys(t) : null);
if (t && typeof t.startAndWait === 'function') {
  const t2 = t.startAndWait();
  console.log('after startAndWait type:', typeof t2, 'thenable:', typeof t2?.then);
  if (t2 && typeof t2.then === 'function') {
    try { const r = await Promise.race([t2, new Promise(res=>setTimeout(()=>res('timeout'),3000))]); console.log('result/timeout', r); }
    catch(e){ console.log('err', e?.message); }
  }
}
