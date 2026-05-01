# jxs

Jitsi XMPP stress test and utility toolkit.

## Building

```
npm install
npm run build
```

Builds to `dist/`.

## Configuration

All scripts read a JSON config file as the first argument. CLI flags (`--key=value`) override config file values. Environment variables (`JXS_*`) sit between the two:

**Precedence:** defaults < config file < environment variables < CLI flags

Environment variable names follow the pattern `JXS_<SCREAMING_SNAKE_CASE>`, e.g. `JXS_JWT`, `JXS_MUC_JID`.

### Common options

| Key | Default | Description |
|-----|---------|-------------|
| `domain` | — | **Required.** XMPP domain. |
| `service` | `wss://{domain}/xmpp-websocket` | WebSocket endpoint. Derived from `domain` and `tenant` when not set. |
| `tenant` | — | Tenant name. When set, `service` becomes `wss://{domain}/{tenant}/xmpp-websocket` and `muc` becomes `conference.{tenant}.{domain}`. |
| `muc` | `conference.{domain}` | MUC domain. |
| `jwt` | — | JWT token. Appended to the service URL as `?token=`. Redacted in logs. |
| `enableDebug` | `false` | Enable debug logging. |
| `enableXmppLog` | `false` | Log XMPP traffic (tokens are redacted). |

---

## muc-join

Connect to XMPP and join a MUC, then wait for SIGINT.

```
node dist/muc-join.js <config> [--muc-jid=<jid>] [--muc-resource=<resource>]
```

**Additional options**

| Key | Default | Description |
|-----|---------|-------------|
| `mucJid` | — | **Required.** Full JID (`room@conference.domain`) or bare name (`room`, expanded using `muc` domain). |
| `mucResource` | first 8 chars of assigned JID | Resource part of the MUC JID. |
| `appendRoomToService` | `true` | Append `?room=<name>` to the service URL. |

**Examples**

Minimal — domain only, bare room name:
```json
{ "domain": "meet.jit.si" }
```
```
node dist/muc-join.js config.json --muc-jid=myroom
```

With tenant and JWT from environment:
```json
{
    "domain": "8x8.vc",
    "tenant": "vpaas-magic-cookie-abc123"
}
```
```
JXS_JWT=eyJhbGc... node dist/muc-join.js config.json --muc-jid=myroom
```

Override MUC resource:
```
node dist/muc-join.js config.json --muc-jid=myroom --muc-resource=testbot-1
```

---

## stress-test

Simulate multiple participants joining multiple conferences.

```
node dist/stress-test.js <config> [number_of_rooms] [number_of_participants]
```

**Additional options**

| Key | Default | Description |
|-----|---------|-------------|
| `roomPrefix` | `jxs-test-{random}` | Prefix for room names. |
| `numberOfRooms` | `1` | Number of rooms. Overridable via CLI positional argument. |
| `numberOfParticipants` | `2` | Participants per room. Overridable via CLI positional argument. |
| `delay` | `0` | Milliseconds between participant joins within a room. |
| `conferenceRequestTarget` | `focus.{domain}` | Conference request target. HTTP URL sends request over HTTP; otherwise sent over XMPP. |
| `duration` | — | Seconds before auto-disconnect. No timeout by default. |
| `joinMuc` | `true` | Whether participants join the MUC. |

**Example**

```json
{
    "domain": "meet.jit.si",
    "roomPrefix": "loadtest",
    "delay": 200,
    "duration": 60
}
```
```
node dist/stress-test.js config.json 5 10
```
Joins 5 rooms with 10 participants each (200 ms apart), disconnects after 60 seconds.
