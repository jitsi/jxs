function coerce(value) {
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value !== true && value !== '' && !isNaN(value)) return Number(value);
    return value;
}

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

        const camel = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        result[camel] = coerce(value);
    }
    return result;
}

/**
 * Read JXS_* environment variables and return them as a camelCase config object.
 * JXS_MUC_JID → mucJid, JXS_JWT → jwt, etc.
 */
function parseEnvVars() {
    const result = {};
    for (const [key, value] of Object.entries(process.env)) {
        if (!key.startsWith('JXS_')) continue;
        // JXS_MUC_JID → muc_jid → mucJid
        const camel = key.slice(4).toLowerCase().replace(/_([a-z])/g, (_, c) => c.toUpperCase());
        result[camel] = coerce(value);
    }
    return result;
}

/**
 * Load config for a script. Call with the script-specific defaults.
 *
 * Resolution order: scriptDefaults < config.json < env vars (JXS_*) < CLI flags.
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
    const envVars = parseEnvVars();

    const fs = require('fs');
    const path = require('path');
    let fileConfig = {};
    if (positional[0]) {
        try {
            fileConfig = JSON.parse(fs.readFileSync(path.resolve(positional[0])));
        } catch (err) {
            console.error(`Failed to read config file "${positional[0]}": ${err.message}`);
            process.exit(1);
        }
    }

    const merged = { ...scriptDefaults, ...fileConfig, ...envVars, ...cliOverrides };

    // Global derived defaults
    if (!merged.domain) {
        console.error('No domain specified. Set "domain" in config.json or pass --domain.');
        process.exit(1);
    }
    if (!merged.service) {
        merged.service = merged.tenant
            ? `wss://${merged.domain}/${merged.tenant}/xmpp-websocket`
            : `wss://${merged.domain}/xmpp-websocket`;
    }
    if (!merged.muc) {
        merged.muc = merged.tenant
            ? `conference.${merged.tenant}.${merged.domain}`
            : `conference.${merged.domain}`;
    }
    merged.conferenceRequestTarget = merged.conferenceRequestTarget || `focus.${merged.domain}`;
    merged.enableDebug = merged.enableDebug || false;
    merged.enableXmppLog = merged.enableXmppLog || false;

    return { config: merged, positional };
}
