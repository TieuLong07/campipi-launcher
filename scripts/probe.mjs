import '../src/network-bootstrap.mjs';
import { installForge } from '@xmcl/installer';
import { setTimeout as wait } from 'node:timers/promises';

const root = process.cwd() + '/.runtime/clean';
const base = 'https://maven.minecraftforge.net/net/minecraftforge/forge/1.20.1-47.4.10/forge-1.20.1-47.4.10-installer.jar';
process.on('unhandledRejection', e => { console.error('UNHANDLED', e?.message, e?.stack?.split('\n').slice(0,3).join(' | ')); });
process.on('uncaughtException', e => { console.error('UNCAUGHT', e?.message, e?.stack?.split('\n').slice(0,3).join(' | ')); });

try {
  const p = installForge({mcversion:'1.20.1',version:'47.4.10',installer:{path:base,sha1:'66bfea9963bfa60d88bab6b2750e74a958392715'}}, root, {
    java:'C:/Program Files/Microsoft/jdk-17.0.20.101-hotspot/bin/java.exe', side:'client', librariesDownloadConcurrency:2,
    mavenHost:['https://maven.minecraftforge.net','https://repo1.maven.org/maven2'],
  });
  console.log('started');
  const v = await Promise.race([p, wait(60000, 'timeout')]);
  console.log('done', v);
} catch (e) {
  console.error('CAUGHT', e?.message, e?.stack?.split('\n').slice(0,5).join(' | '));
}
