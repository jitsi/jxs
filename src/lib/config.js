import { randomInt } from '../util';

/**
 * Parse --key=value and --key value CLI flags into an object.
 * Keys are camelCased (--muc-jid → mucJid).
 */
function parseCliFlags(argv) {
    const result = {};
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (!arg.startsWith('--')) continue;

        let key, value;
        const eqIdx = arg.indexOf('=');
        if (eqIdx !== -1) {
            key = arg.slice(2, eqIdx);
            value = arg.slice(eqIdx + 1);
        } else {
            key = arg.slice(2);
            value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
        }

        // kebab-case → camelCase
        const camel = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        // coerce booleans and numbers
        if (value === 'true') value = true;
        else if (value === 'false') value = false;
        else if (value !== true && !isNaN(value)) value = Number(value);
        result[camel] = value;
    }
    return result;
}

/**
 * Load config for a script. Call with the script-specific defaults.
 *
 * Resolution order: scriptDefaults < config.json < CLI flags.
 *
 * The first non-flag positional argument after argv[1] is the config file path.
 * Remaining positional arguments are returned as `positional`.
 */
export function loadConfig(scriptDefaults = {}) {
    const args = process.argv.slice(2);
    const positional = [];
    const flagStart = args.findIndex(a => a.startsWith('--'));

    // positional args come before the first flag (or all args if no flags)
    const positionalEnd = flagStart === -1 ? args.length : flagStart;
    for (let i = 0; i < positionalEnd; i++) {
        positional.push(args[i]);
    }
    const flagArgs = flagStart === -1 ? [] : args.slice(flagStart);
    const cliOverrides = parseCliFlags(flagArgs);

    const fs = require('fs');
    const path = require('path');
    let fileConfig = {};
    if (positional[0]) {
        try {
            fileConfig = JSON.parse(fs.readFileSync(path.resolve(positional[0])));
        } catch (err) {
            console.error(`Error reading config file (${positional[0]}): ${err.message}`);
            process.exit(1);
        }
    }

    const merged = { ...scriptDefaults, ...fileConfig, ...cliOverrides };

    // Global derived defaults
    if (!merged.domain) {
        console.error('No domain specified (set in config.json or pass --domain)');
        process.exit(1);
    }
    merged.service = merged.service || `wss://${merged.domain}/xmpp-websocket`;
    merged.muc = merged.muc || `conference.${merged.domain}`;
    merged.enableDebug = merged.enableDebug || false;
    merged.enableXmppLog = merged.enableXmppLog || false;

    return { config: merged, positional };
}
