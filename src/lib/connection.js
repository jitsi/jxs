import { client } from '@xmpp/client';

function redact(value) {
    if (typeof value !== 'string') return value;
    return value.replace(/([?&]token=)[^&\s]+/g, '$1<redacted>');
}

/**
 * Connect to XMPP and resolve with the xmpp client instance and assigned JID.
 * Rejects on error before the first 'online' event.
 *
 * @param {object} config
 * @param {string} config.service  - WebSocket URL
 * @param {string} config.domain
 * @param {boolean} [config.enableXmppLog]
 * @returns {Promise<{xmpp, jid}>}
 */
export function connect(config) {
    const { service, domain, enableXmppLog } = config;
    const xmpp = client({ service, domain });

    if (enableXmppLog) {
        // Replicate @xmpp/debug behaviour but redact ?token= from URLs in status events
        // to avoid leaking JWTs in logs.
        xmpp.on('status', (status, value) => console.debug('status', status, redact(value) ?? ''));
        xmpp.on('input', input => console.debug('<<<', input));
        xmpp.on('output', output => console.debug('>>>', output));
    }

    return new Promise((resolve, reject) => {
        const onError = (err) => {
            xmpp.removeListener('online', onOnline);
            reject(err);
        };
        const onOnline = (jid) => {
            xmpp.removeListener('error', onError);
            resolve({ xmpp, jid });
        };

        xmpp.once('online', onOnline);
        xmpp.once('error', onError);
        xmpp.start().catch(reject);
    });
}

/**
 * Gracefully stop the xmpp client.
 */
export async function disconnect(xmpp) {
    try {
        await xmpp.stop();
    } catch (err) {
        console.error('Error while stopping XMPP client:', err);
    }
}
