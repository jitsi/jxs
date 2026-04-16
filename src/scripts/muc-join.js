import { loadConfig } from '../lib/config';
import { connect, disconnect } from '../lib/connection';
import { joinMuc, leaveMuc } from '../lib/muc';
import { log } from '../util';

const { config } = loadConfig({
    // script-specific defaults
    mucResource: 'jxs-muc-join',
});

const { domain, service, mucJid, mucResource, muc } = config;

if (!mucJid) {
    console.error('No mucJid specified (set in config.json or pass --muc-jid)');
    process.exit(1);
}

const fullMucJid = `${mucJid}/${mucResource}`;

log(`Connecting to ${service} (domain: ${domain})`);

let xmpp;

async function main() {
    ({ xmpp } = await connect(config));
    log(`Connected as ${xmpp.jid || '(unknown)'}`);

    log(`Joining MUC: ${fullMucJid}`);
    const { joinedAt } = await joinMuc(xmpp, fullMucJid);
    log(`Joined MUC at ${joinedAt.toISOString()}`);
}

async function cleanup() {
    if (!xmpp) return;
    log('Leaving MUC and disconnecting...');
    try { await leaveMuc(xmpp, fullMucJid); } catch (_) {}
    await disconnect(xmpp);
    log('Done.');
    process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

main().catch((err) => {
    console.error('Fatal:', err);
    process.exit(1);
});
