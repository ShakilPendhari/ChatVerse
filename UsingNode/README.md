# WebSocket Library (working name: TBD)

A from-scratch, RFC 6455–compliant WebSocket implementation in Node.js, built without the `ws` or `socket.io` packages — the goal is a socket.io-level feature set (rooms, namespaces, acks, reconnection) with a hosted-service monetization path, not a library sold on its own.

## Status: Phase 1 — Working (in progress, not yet correct)

We have a functioning HTTP server with WebSocket upgrade handling. It can complete a handshake and decode simple text frames, but it is **not RFC-compliant yet** and has known security gaps. Do not use this outside local testing.

### What's implemented
- HTTP file server (serves `index.html`, `style.css`, `app.js`) via `http.createServer`.
- WebSocket handshake: reads `Sec-WebSocket-Key`, computes `Sec-WebSocket-Accept` (SHA-1 + RFC magic GUID, base64), responds `101 Switching Protocols`.
- TCP stream buffering: accumulates chunks across `socket.on('data', ...)` since WS frames don't align to TCP segments.
- Frame header parsing: FIN bit, opcode, mask bit, and all three payload-length cases (7-bit / 16-bit extended / 64-bit extended).
- Client-frame unmasking via XOR against the 4-byte masking key.
- Text frame (`0x1`) decode + log.
- Close frame (`0x8`) detection → `socket.end()`.
- Minimal browser client (`new WebSocket(...)`) with a manual test harness for 1-byte, 2-byte, and 700,000-byte payloads to exercise all three length-encoding paths.

### Known issues (found in review, not yet fixed)
Ranked by severity — top of list gets fixed first, regardless of what feels more interesting to build.

**Security / correctness — block everything else until done:**
1. No max-payload size enforcement. A crafted 64-bit length field can trigger unbounded `Buffer.alloc`, crashing the process. This is the single highest-priority fix.
2. `Sec-WebSocket-Key` and `Sec-WebSocket-Version` aren't validated before completing the handshake — malformed/malicious upgrade requests still get a `101`.
3. Close handshake is one-directional — we don't echo a Close frame back per RFC before ending the socket.

**RFC compliance gaps:**
4. No Ping/Pong (`0x9`/`0xA`) handling — connection will be treated as dead by liveness-checking clients/proxies.
5. No continuation-frame (`0x0`) handling — fragmented messages are silently dropped; `fin` is parsed but unused.
6. No binary frame (`0x2`) support — text only.
7. RSV bits not validated.

**Not yet wired:**
8. Frontend UI (join/send buttons) isn't connected to the actual `WebSocket` instance — currently just logs to console.

**Performance (defer until after correctness):**
9. `Buffer.concat` per chunk is O(n) copy each time — fine now, needs a growable-buffer rewrite before load testing in Phase 3.

## Roadmap

### Phase 0 — Decisions (done)
- Transport: RFC 6455 raw WebSocket frames (compatibility is the wedge, not a custom protocol).
- Package layout: `core` (raw WS), `engine` (event/room/ack layer), `adapter-redis` (scaling) as separate publishable packages, mirroring socket.io's structure.
- Monetization model: OSS core stays free (the funnel); revenue comes from a hosted managed real-time service (scaling, presence, dashboards, SLA) — same model as Pusher/Ably. Not planning to sell the library itself.

### Phase 1 — Working (current phase)
Goal: correctness, not features. Fix items 1–3 above immediately, then 4–7. Exit criteria: passes Autobahn Testsuite's basic + framing test categories; holds a multi-message chat demo without crashing or leaking frames.

### Phase 2 — Feature parity (socket.io-level API)
- Packet protocol on top of raw frames: event name + payload + optional ack-id.
- Namespaces and rooms (`Map<room, Set<socketId>>`, single-node only — no Redis yet).
- Ack/callback via pending-promise map keyed by ack-id, with timeout.
- Client auto-reconnect with exponential backoff and room rejoin on reconnect.
- Exit criteria: an existing socket.io demo (chat + rooms) runs against this library with only the import swapped.

### Phase 3 — Production hardening
- Backpressure handling (`socket.write()` return value respected).
- `permessage-deflate` (RFC 7692) compression.
- Security: origin validation, payload size limits, handshake timeout, per-connection rate limiting.
- Full Autobahn Testsuite pass (all categories).
- Benchmark vs `ws` and `socket.io` on connections/sec, msgs/sec, memory per idle connection — must win on at least one axis or the product has no differentiator.

### Phase 4 — Scaling
- Redis pub/sub adapter for cross-instance room broadcast and presence.
- This is the actual seed of the hosted service, not a side feature.

### Phase 5 — Productization
- TypeScript-first with strict generic event typing (planned differentiator vs socket.io's looser typing).
- Docs site + socket.io migration guide.
- CI: Autobahn + unit + load tests gating every PR; semver + changelogs.
- Public benchmark page as both proof and marketing.

### Phase 6 — Monetization
- Core stays MIT/free.
- Paid tier: hosted service with managed scaling, dashboards, SLA, audit logs, enterprise SSO.

## How we get there
Each phase has a hard exit criterion (above) — no moving to the next phase on "feels done." Phase 1 doesn't end until Autobahn's basic/framing suite passes; Phase 2 doesn't end until a real socket.io app runs unmodified. Bugs found in review get fixed before new features get added, not after — the security items (1–3) are non-negotiable next steps.