import '../src/network-bootstrap.mjs';
import { mkdir, writeFile, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { getVersionList, installTask, installForge } from '@xmcl/installer';
import { verifySha1, createLaunchOptions } from '../src/engine.mjs';
import { createDownloadDispatcher } from '../src/network.mjs';
const dispatcher = createDownloadDispatcher();

const root = path.resolve('.runtime/clean');
const java = 'C:/Program Files/Microsoft/jdk-17.0.20.101-hotspot/bin/java.exe';
const evidence = path.resolve('docs/evidence/phase-0');
await mkdir(evidence, { recursive: true });
await mkdir(root, { recursive: true });
createLaunchOptions({root, java, version: '1.20.1'});
const record = async (event, data = {}) => {
  const line = JSON.stringify({time: new Date().toISOString(), event, ...data});
  console.log(line); await appendFile(path.join(evidence, 'install.jsonl'), line+'\n');
};
try {
  await record('start', {root, java, cleanSource: 'official downloads; no old libraries/cache'});
  const manifest = await getVersionList();
  const meta = manifest.versions.find(v => v.id === '1.20.1');
  if (!meta) throw new Error('Official Minecraft 1.20.1 metadata missing');
  await record('vanilla-install');
  await installTask(meta, root, { dispatcher, assetsDownloadConcurrency: 4, librariesDownloadConcurrency: 4 }).startAndWait();
  await record('vanilla-installed');
  const base = 'https://maven.minecraftforge.net/net/minecraftforge/forge/1.20.1-47.4.10/forge-1.20.1-47.4.10-installer.jar';
  const resp = await fetch(base+'.sha1', {signal: AbortSignal.timeout(30000)});
  if (!resp.ok) throw new Error('Forge checksum HTTP '+resp.status);
  const sha1 = (await resp.text()).trim().split(/\s+/)[0];
  const installer = await fetch(base, {signal: AbortSignal.timeout(120000)});
  if (!installer.ok) throw new Error('Forge installer HTTP '+installer.status);
  verifySha1(Buffer.from(await installer.arrayBuffer()), sha1);
  await record('forge-checksum-verified', {sha1});
  const version = await installForge({mcversion:'1.20.1',version:'47.4.10',installer:{path:base,sha1}}, root, {
    java, dispatcher, side:'client', librariesDownloadConcurrency:2,
    mavenHost: ['https://maven.minecraftforge.net', 'https://repo1.maven.org/maven2'],
  });
  await writeFile(path.join(evidence,'installed.json'),JSON.stringify({root, java, version, forgeInstallerSha1:sha1},null,2));
  await record('forge-installed',{version});
  await dispatcher.close();
} catch(error) {
  await record('failed',{message:error.message,stack:error.stack,details:JSON.stringify(error,Object.getOwnPropertyNames(error)).slice(0,10000)});
  process.exitCode=1;
  try { await dispatcher.close(); } catch {}
}
