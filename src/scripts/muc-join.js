import { loadConfig } from '../lib/config';
import { connect, disconnect } from '../lib/connection';
import { joinMuc, leaveMuc } from '../lib/muc';
import { log } from '../util';

const { config } = loadConfig({
    appendRoomToService: true,
});

const { domain, mucJid } = config;

if (!mucJid) {
    console.error('No MUC JID specified. Set "mucJid" in config.json or pass --muc-jid.');
    process.exit(1);
}

const resolvedMucJid = mucJid.includes('@') ? mucJid : `${mucJid}@${config.muc}`;

const serviceUrl = new URL(config.service);
if (config.appendRoomToService) {
    serviceUrl.searchParams.set('room', resolvedMucJid.split('@')[0]);
}
if (config.jwt) {
    serviceUrl.searchParams.set('token', config.jwt);
}
config.service = serviceUrl.toString();

const logUrl = new URL(config.service);
if (logUrl.searchParams.has('token')) logUrl.searchParams.set('token', '<redacted>');
log(`Connecting to ${logUrl} (domain: ${domain}).`);

let xmpp;
let fullMucJid;

async function main() {
    ({ xmpp } = await connect(config));
    log(`Connected as ${xmpp.jid}.`);

    const resource = config.mucResource || xmpp.jid.local.slice(0, 8);
    fullMucJid = `${resolvedMucJid}/${resource}`;

    log(`Joining MUC: ${fullMucJid}.`);
    const { joinedAt } = await joinMuc(xmpp, fullMucJid);
    log(`Joined MUC at ${joinedAt.toISOString()}.`);
}

async function cleanup() {
    if (!xmpp) return;
    log('Leaving MUC and disconnecting.');
    try { 
        if (fullMucJid) {
            await leaveMuc(xmpp, fullMucJid);
        }
    } catch (error) {
        console.error(`Error while leaging room ${resolvedMucJid}: `, error);
    }
    await disconnect(xmpp);
    log('Disconnected.');
    process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
