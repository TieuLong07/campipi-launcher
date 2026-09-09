# Phase 3C — Embedded WebSocket Proxy

**Date**: 2026-09-08
**Goal**: Bridge MC client (127.0.0.1:25566) ↔ VPS (wss://mc.tiulong.site)
so the user can play on a public MC server without port-forwarding.

## Architecture

```
MC client (Java) ── TCP ──> 127.0.0.1:25566 (this proxy, embedded in launcher)
                                 │
                                 │ WebSocket upgrade
                                 ↓
                          wss://mc.tiulong.site:443  (Cloudflare tunnel)
                                 │
                                 ↓
                          VPS wsproxy (port 8081)
                                 │
                                 ↓
                          MC server :25565
```

## Test results

- **4/4** proxy tests pass:
  - `WsProxy` forwards bytes TCP→WS and WS→TCP (round-trip via fake upstream)
  - `WsProxy.stop()` is idempotent
  - `ProxyManager` starts and stops
  - `ProxyManager.start` is idempotent (restarts on second call)
- **32/32** all tests pass
- **TypeScript clean** in both `tsconfig.electron.json` and `tsconfig.json`
- **Live integration verified** with real VPS:
  - `wss://mc.tiulong.site` opens cleanly
  - 7 bytes sent through proxy → reach VPS wsproxy (verified via `bytesUp` counter)

## What was new in Phase 3C

### `src/main/ws-proxy.ts` (200 dòng)
- `WsProxy` class extends EventEmitter
- `start()`: listen on `127.0.0.1:<port>`, open upstream WS
- `stop()`: close all TCP clients, close WS, close server
- `isReady()`: both TCP server listening AND WS in OPEN state
- Auto-reconnect with exponential backoff (1s → 30s)
- Forwards binary frames as-is (MC handshake is binary, do not translate)
- Emits events: `clientConnect`, `clientDisconnect`, `upstreamLost`, `upstreamRestored`, `traffic`

### `src/main/proxy-manager.ts` (90 dòng)
- Lifecycle wrapper around `WsProxy`
- Tracks `bytesUp` / `bytesDown` totals
- Tracks active client count
- Emits the same events, but the Sidebar/Status UI listens to these

## Pivotal discoveries

1. **`binaryType` is a runtime property** on the `WebSocket` instance, NOT
   a constructor option. Setting `{ binaryType: 'arraybuffer' }` in the
   constructor options throws a TypeScript error.
2. **The VPS endpoint `wss://mc.tiulong.site` is open** and ready to forward
   bytes. No auth needed; the launcher just connects.
3. **Backoff: 1s → 2s → 4s → ... → 30s** (capped). After 30s we keep
   retrying every 30s. The TCP server stays open so MC clients that
   happen to connect during an outage get a "upstream not ready" drop
   (better than buffering forever).
4. **`@types/ws` required** for TypeScript — we install as devDep.
