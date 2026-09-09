import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { launch, generateArguments, createMinecraftProcessWatcher } from '@xmcl/core';
import { createLaunchOptions } from '../src/engine.mjs';

const evidence = path.resolve('docs/evidence/phase-0');
const installed = JSON.parse(await readFile(path.join(evidence,'installed.json'),'utf8'));
const version = process.argv.includes('--vanilla') ? '1.20.1' : installed.version;
const label = process.argv.includes('--vanilla') ? 'vanilla' : process.argv.includes('--pack') ? 'full-pack' : 'forge-empty';
const options = createLaunchOptions({root:installed.root,java:installed.java,version});
await mkdir(evidence,{recursive:true});
const args = await generateArguments(options);
// This qualification uses only explicit demo credentials. Still redact the token in evidence.
const safeArgs = args.map((v,i)=>args[i-1]==='--accessToken'?'[REDACTED]':v);
await writeFile(path.join(evidence,label+'-args.json'),JSON.stringify(safeArgs,null,2));
const output = createWriteStream(path.join(evidence,label+'-console.log'),{flags:'a'});
const proc = await launch(options);
await writeFile(path.join(evidence,'current-process.json'),JSON.stringify({pid:proc.pid,label,root:installed.root,version},null,2));
console.log(JSON.stringify({event:'spawned',pid:proc.pid,label,mode:'demo',notProofOfSuccess:true}));
proc.stdout?.pipe(output,{end:false}); proc.stderr?.pipe(output,{end:false});
const watcher = createMinecraftProcessWatcher(proc);
watcher.on('minecraft-window-ready',()=>console.log(JSON.stringify({event:'window-ready-log-marker',label,visualVerificationRequired:true})));
proc.on('error',e=>{ console.error(e); process.exitCode=1; });
proc.on('exit',(code,signal)=>{
  console.log(JSON.stringify({event:'exit',code,signal,label})); output.end(); process.exitCode=code===0?0:1;
});
