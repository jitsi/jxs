# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # install deps
npm run build        # webpack → dist/stress-test.js, dist/muc-join.js
node dist/stress-test.js config.json [rooms] [participants]
node dist/muc-join.js config.json --muc-jid=<room>
```

No test suite. No linter configured.

## Architecture

**jxs** is a Jitsi XMPP stress test tool. Simulates multiple participants joining Jitsi conferences over XMPP/Jingle.

### Flow

1. `src/index.js` reads `config.json`, creates N rooms × M participants
2. Each `Participant` connects via XMPP (`@xmpp/client`), joins a MUC
3. Participant sends a conference-request (HTTP or XMPP IQ, controlled by `conferenceRequestTarget`)
4. On Jingle `session-initiate`, participant responds with `session-accept` (fake SDP with audio/video SSRCs)
5. Keepalive via XMPP pings every 10s
6. After `duration` seconds, all participants disconnect

### Key files

- `src/index.js` — orchestration, timing, room/participant lifecycle
- `src/Participant.js` — XMPP client, MUC join, Jingle signaling, presence
- `src/util.js` — `randomInt`, `generateSsrc`, `log`

### Config options (`config.json`)

| Key | Purpose |
|-----|---------|
| `domain` | XMPP domain |
| `service` | WebSocket URL |
| `roomPrefix` | MUC room name prefix |
| `numberOfRooms` / `numberOfParticipants` | scale |
| `delay` | ms between participant joins |
| `conferenceRequestTarget` | `"http"` or `"xmpp"` |
| `disableJoinMuc` | skip MUC join (test without conference) |
| `skipConferenceRequest` | join MUC without sending conference-request to jicofo |
| `duration` | how long participants stay (seconds) |
| `enableDebug` / `enableXmppLog` | verbose logging |

### Build

Webpack (production mode, Node target) + Babel (JSX with custom `xml` pragma from `@xmpp/xml`). JSX syntax used for building XMPP stanzas.
