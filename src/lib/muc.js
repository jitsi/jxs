/** @jsx xml */
import { xml } from '@xmpp/client';

/**
 * Join a MUC and resolve when self-presence is received (status 110).
 *
 * @param {object} xmpp   - connected @xmpp/client instance
 * @param {string} mucJid - full MUC JID including resourcepart, e.g. room@conference.domain/nick
 * @param {object} [options]
 * @param {Array}  [options.presenceChildren] - extra XML children to include in join presence
 * @returns {Promise<{joinedAt: Date, mucJid: string}>}
 */
export function joinMuc(xmpp, mucJid, { presenceChildren = [] } = {}) {
    return new Promise((resolve, reject) => {
        const onStanza = (stanza) => {
            if (!stanza.is('presence')) return;
            if (stanza.attrs.from !== mucJid) return;
            if (stanza.attrs.type === 'error') {
                xmpp.removeListener('stanza', onStanza);
                const err = stanza.getChild('error');
                reject(new Error(`MUC join error: ${err ? err.toString() : stanza.toString()}`));
                return;
            }
            const x = stanza.getChild('x', 'http://jabber.org/protocol/muc#user');
            const isSelf = x && x.getChildren('status').some(s => s.attrs.code === '110');
            if (isSelf) {
                xmpp.removeListener('stanza', onStanza);
                resolve({ joinedAt: new Date(), mucJid });
            }
        };

        xmpp.on('stanza', onStanza);

        xmpp.send(
            <presence to={mucJid} xmlns="jabber:client">
                <x xmlns="http://jabber.org/protocol/muc"/>
                {presenceChildren}
            </presence>
        ).catch((err) => {
            xmpp.removeListener('stanza', onStanza);
            reject(err);
        });
    });
}

/**
 * Leave a MUC by sending unavailable presence.
 *
 * @param {object} xmpp
 * @param {string} mucJid - same full JID used to join
 */
export async function leaveMuc(xmpp, mucJid) {
    await xmpp.send(
        <presence to={mucJid} type="unavailable" xmlns="jabber:client"/>
    );
}
