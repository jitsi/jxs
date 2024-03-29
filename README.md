# jxs

## Building
```
npm install
npm run build
```

You can find the build in `dist/`. There's only one bundled file there - `main.js`.

## Runnning

```
npm start <path_to_config_json> [number_of_conferences] [number_of_participants_per_conference]
```

or

```
node dist/main.js <path_to_config_json> [number_of_conferences] [number_of_participants_per_conference]
```

### Configuration

You must specify the path to a configuration file in JSON format as the first command line argument. We read the following properties from there:
 -- `domain` - required, the domain of the xmpp server.
 -- `service` - optional, the websocket XMPP endpoint. Defaults to `wss://${domain}/xmpp-websocket`.
 -- `roomPrefix` - optional, the prefix for the names of the rooms to join. Defaults to `jxs-test-${random}`
 -- `numberOfRooms` - optional, number of rooms to join. Defaults to 1, can be overriden by a command line argument.
 -- `numberOfParticipants` - optional, the number of participants in each room. Defaults to 1, can be overriden by a command line argument.
 -- `delay` - optional, the number of milliseconds to wait between participants in a room (independent for each room). Defaults to 0.
 -- `enableDebug` - optional, enable debug logging. Defaults to false.
 -- `enableXmppLog` - optional, enables logging XMPP traffic. Defaults to false.
 -- `conferenceRequestTarget` - optional, the target to send conference-request to. If this starts with 'http://' or 'https://' the conference request is sent over HTTP (prior to logging in to XMPP). Otherwise, it's sent over XMPP. Defaults to `focus.${domain}` (XMPP).
 -- `duration` - optional, number of second to wait before timing out. Defaults to no automatic timeout.

Note that command line arguments override the values in the config file.

