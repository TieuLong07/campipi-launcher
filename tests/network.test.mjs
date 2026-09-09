import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { download } from '@xmcl/file-transfer';

test('download dispatcher supports legacy XMCL redirects with patched undici', async () => {
  const { createDownloadDispatcher } = await import('../src/network.mjs');
  const server=http.createServer((req,res)=>{
    if(req.url==='/redirect'){res.writeHead(302,{Location:'/file'});res.end();}
    else {res.writeHead(200,{'Content-Length':'3'});res.end('abc');}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const dispatcher=createDownloadDispatcher();
  try {
    const dir=await mkdtemp(path.join(os.tmpdir(),'mcpubg-net-'));
    const destination=path.join(dir,'payload');
    await download({url:`http://127.0.0.1:${server.address().port}/redirect`,destination,dispatcher,
      validator:{algorithm:'sha1',hash:'a9993e364706816aba3e25717850c26c9cd0d89d'}});
    assert.equal(await readFile(destination,'utf8'),'abc');
  } finally {await dispatcher.close();await new Promise(resolve=>server.close(resolve));}
});
