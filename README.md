# jxs

## Building
```
npm install
npm run build
```

You can find the build in `dist/`. There's only one bundled file there - `main.js`.

## Runnning

```
npm start <path_to_config_json> <number_of_conferences> <number_of_participants_per_conference>
```

or

```
node dist/main.js <path_to_config_json> <number_of_conferences> <number_of_participants_per_conference>
```

### Config.json

You must specify the path to a `config.json` file as a first argument of the app. We read the following properties from there:
 - service - required. This will be a service URL to the xmpp server that we use.
 - domain - required. The domain of the xmpp server.
 - muc - required. The XMPP MUC domain.
 - focus - optional.  Focus component domain. Defaults to focus.<domain>.

