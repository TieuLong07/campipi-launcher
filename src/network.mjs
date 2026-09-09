import './network-bootstrap.mjs';
import { Agent, interceptors } from 'undici';

export function createDownloadDispatcher() {
  return new Agent({connections: 4, pipelining: 1, connect: {timeout: 60000}})
    .compose(interceptors.redirect({maxRedirections: 5}));
}
