/** @jsx xml */
import EventEmitter from 'events';
import { xml } from '@xmpp/client';
import fetch from 'node-fetch';
import { generateSsrc, log } from './util';
import { connect, disconnect } from './lib/connection';
import { joinMuc, leaveMuc } from './lib/muc';

export default class Participant extends EventEmitter {
    constructor(id, config = {}) {
        super();
        this._id = id;
        this._config = config;
    }

    _debug(...args) {
        if (this._config.enableDebug) {
            log(`${this}`, ...args);
        }
    }

    toString() {
        return `Participant[id=${this._id}]`;
    }

    async join() {
        const { service, domain, room, muc, conferenceRequestTarget } = this._config;

        try {
            const url = this._getConferenceRequestUrl();
            if (url) {
                await this._sendConferenceRequestHttp(url);
            }

            const { xmpp, jid } = await connect({
                service: `${service}?room=${room}`,
                domain,
                enableXmppLog: this._config.enableXmppLog
            });
            this._xmpp = xmpp;
            this._jid = jid;
            this._machineID = jid.local;
            this._mucJID = `${room}@${muc}/${jid.local.slice(0, 8)}`;

            this._debug('Online.');
            this.emit('online', jid);

            xmpp.on('error', (err) => {
                log(`${this}: error: ${err}`);
                this.emit('error', err);
            });
            xmpp.on('offline', () => {
                log(`${this}: offline.`);
                this.emit('offline');
            });
            xmpp.on('stanza', (stanza) => this.emit('stanza', stanza));
            xmpp.iqCallee.set('urn:xmpp:jingle:1', 'jingle', this._onJingle.bind(this));

            if (!url) {
                await this._sendConferenceRequestXmpp(conferenceRequestTarget);
            }

            await joinMuc(xmpp, this._mucJID, { presenceChildren: this._buildPresenceChildren() });
            log(`${this}: joined.`);
            this.emit('joined');

            this._startPing();
            this.emit('join-finished');
        } catch (err) {
            log(`${this}: failed to join: ${err}`);
            this.emit('error', err);
        }
    }

    _buildPresenceChildren() {
        return [
            <stats-id>participant-{this._id}</stats-id>,
            <region id="us-east-1" xmlns="http://jitsi.org/jitsi-meet"/>,
            <c xmlns="http://jabber.org/protocol/caps" hash="sha-1" node="https://jitsi.org/jitsi-meet" ver="145G7HAtbAUYSkQzy4VtpQNqU3o="/>,
            <jitsi_participant_region>us-east-1</jitsi_participant_region>,
            <avatar-id>e8b7ee7bbac3a53f14a711b538526bf3</avatar-id>,
            <nick xmlns="http://jabber.org/protocol/nick">{this._id}</nick>,
            <audiomuted xmlns="http://jitsi.org/jitmeet/audio">false</audiomuted>,
            <videoType xmlns="http://jitsi.org/jitmeet/video">camera</videoType>,
            <videomuted xmlns="http://jitsi.org/jitmeet/video">false</videomuted>
        ];
    }

    async _sendConferenceRequestXmpp(_toJid) {
        // XMPP conference-request not yet implemented
        log(`${this}: warning: XMPP conference-request is not implemented, skipping.`);
    }

    async _sendConferenceRequestHttp(url) {
        const { room, muc } = this._config;
        const fullRoom = `${room}@${muc}`;
        this._debug(`Sending conference request to ${url}, room=${fullRoom}.`);

        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                machineUid: this._machineID, 
                room: fullRoom
            })
        })
            .then(response => response.json())
            .then(response => this._debug(`Conference request response: ${JSON.stringify(response)}.`));
    }

    async _sendAudioMute(mute) {
        this._debug(`Sending audio mute: ${mute}.`);
        try {
            await this._xmpp.send(<presence to={this._mucJID} xmlns="jabber:client">
                <stats-id>participant-{this._id}</stats-id>
                <region id="us-east-1" xmlns="http://jitsi.org/jitsi-meet"/>
                <c hash="sha-1" node="https://jitsi.org/jitsi-meet" ver="145G7HAtbAUYSkQzy4VtpQNqU3o=" xmlns="http://jabber.org/protocol/caps"/>
                <jitsi_participant_region>us-east-1</jitsi_participant_region>
                <avatar-id>e8b7ee7bbac3a53f14a711b538526bf3</avatar-id>
                <nick xmlns="http://jabber.org/protocol/nick">{this._id}</nick>
                <audiomuted xmlns="http://jitsi.org/jitmeet/audio">{mute}</audiomuted>
                <videoType xmlns="http://jitsi.org/jitmeet/video">camera</videoType>
                <videomuted xmlns="http://jitsi.org/jitmeet/video">false</videomuted>
            </presence>);
        } catch (err) {
            log(`${this}: failed to send audio mute: ${err}`);
        }
    }

    async _sendMessage(txt) {
        this._debug(`Sending message: ${txt}.`);
        try {
            await this._xmpp.send(<message to={this._mucJID} type="groupchat" xmlns="jabber:client">
                <body>{txt}</body>
            </message>);
        } catch (err) {
            log(`${this}: failed to send message: ${err}`);
        }
    }

    _onJingle(ctx) {
        const { element, stanza } = ctx;
        if (element.attrs.action === 'session-initiate') {
            this._debug('Received session-initiate.');
            setTimeout(() => this._sendSessionAccept(element, stanza), 10);
        }
        return true;
    }

    _sendSessionAccept(jingle, iq) {
        const ssrc = {
            audio: generateSsrc(),
            video: [
                generateSsrc(),
                generateSsrc(),
                generateSsrc(),
                generateSsrc(),
                generateSsrc(),
                generateSsrc()
            ]
        };
        const sessionAccept = <iq to={iq.attrs.from} type="set" xmlns="jabber:client">
            <jingle
                action="session-accept"
                initiator={iq.attrs.from}
                responder={this._jid}
                sid={jingle.attrs.sid}
                xmlns="urn:xmpp:jingle:1">
                <group semantics="BUNDLE" xmlns="urn:xmpp:jingle:apps:grouping:0">
                    <content name="audio"/>
                    <content name="video"/>
                </group>
                <content creator="responder" name="audio" senders="both">
                    <description media="audio" ssrc={ssrc.audio} xmlns="urn:xmpp:jingle:apps:rtp:1">
                        <payload-type channels="2" clockrate="48000" id="111" name="opus">
                            <parameter name="minptime" value="10"/>
                            <parameter name="useinbandfec" value="1"/>
                            <rtcp-fb type="transport-cc" xmlns="urn:xmpp:jingle:apps:rtp:rtcp-fb:0"/>
                        </payload-type>
                        <payload-type channels="1" clockrate="16000" id="103" name="ISAC"/>
                        <payload-type channels="1" clockrate="32000" id="104" name="ISAC"/>
                        <payload-type channels="1" clockrate="8000" id="126" name="telephone-event"/>
                        <source ssrc={ssrc.audio} xmlns="urn:xmpp:jingle:apps:rtp:ssma:0">
                            <parameter name="cname" value={`cname-${this._id}`}/>
                            <parameter name="msid" value={`audio-stream-${this._id} audio-track-${this._id}`}/>
                        </source>
                        <rtcp-mux/>
                        <rtp-hdrext id="1" uri="urn:ietf:params:rtp-hdrext:ssrc-audio-level" xmlns="urn:xmpp:jingle:apps:rtp:rtp-hdrext:0"/>
                        <rtp-hdrext id="5" uri="http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01" xmlns="urn:xmpp:jingle:apps:rtp:rtp-hdrext:0"/>
                    </description>
                    <transport pwd="mbXdhJhxCTpxn72IN15DfPPy" ufrag="ax9g" xmlns="urn:xmpp:jingle:transports:ice-udp:1">
                        <fingerprint hash="sha-256" setup="passive" xmlns="urn:xmpp:jingle:apps:dtls:0">9F:16:C2:FF:E7:94:E4:70:83:FF:EE:F3:DA:92:C0:B2:31:97:50:B6:E4:EC:39:B0:00:30:89:94:2D:23:16:ED</fingerprint>
                        <candidate component="1" foundation="1078452949" generation="0" id="2f0wqighpf" ip="2605:a601:ab75:ca00:20ea:1102:2d66:aee" network="1" port="56613" priority="2122262783" protocol="udp" type="host"/>
                    </transport>
                </content>
                <content creator="responder" name="video" senders="both">
                    <description media="video" ssrc={ssrc.video[0]} xmlns="urn:xmpp:jingle:apps:rtp:1">
                        <payload-type channels="1" clockrate="90000" id="100" name="VP8">
                            <rtcp-fb type="goog-remb" xmlns="urn:xmpp:jingle:apps:rtp:rtcp-fb:0"/>
                            <rtcp-fb type="transport-cc" xmlns="urn:xmpp:jingle:apps:rtp:rtcp-fb:0"/>
                            <rtcp-fb subtype="fir" type="ccm" xmlns="urn:xmpp:jingle:apps:rtp:rtcp-fb:0"/>
                            <rtcp-fb type="nack" xmlns="urn:xmpp:jingle:apps:rtp:rtcp-fb:0"/>
                            <rtcp-fb subtype="pli" type="nack" xmlns="urn:xmpp:jingle:apps:rtp:rtcp-fb:0"/>
                        </payload-type>
                        <payload-type channels="1" clockrate="90000" id="96" name="rtx">
                            <parameter name="apt" value="100"/>
                        </payload-type>
                        <source ssrc={ ssrc.video[0] } xmlns="urn:xmpp:jingle:apps:rtp:ssma:0">
                            <parameter name="cname" value={`cname-${this._id}`}/>
                            <parameter name="msid" value={`video-stream-${this._id} video-track-${this._id}`}/>
                        </source>
                        <source ssrc={ ssrc.video[1] } xmlns="urn:xmpp:jingle:apps:rtp:ssma:0">
                            <parameter name="cname" value={ `cname-${this._id}` }/>
                            <parameter name="msid" value={ `video-stream-${this._id} video-track-${this._id}` }/>
                        </source>
                        <source ssrc={ ssrc.video[2] } xmlns="urn:xmpp:jingle:apps:rtp:ssma:0">
                            <parameter name="cname" value={ `cname-${this._id}` }/>
                            <parameter name="msid" value={ `video-stream-${this._id} video-track-${this._id}` }/>
                        </source>
                        <source ssrc={ ssrc.video[3] } xmlns="urn:xmpp:jingle:apps:rtp:ssma:0">
                            <parameter name="cname" value={ `cname-${this._id}` }/>
                            <parameter name="msid" value={ `video-stream-${this._id} video-track-${this._id}` }/>
                        </source>
                        <source ssrc={ ssrc.video[4] } xmlns="urn:xmpp:jingle:apps:rtp:ssma:0">
                            <parameter name="cname" value={ `cname-${this._id}` }/>
                            <parameter name="msid" value={ `video-stream-${this._id} video-track-${this._id}` }/>
                        </source>
                        <source ssrc={ ssrc.video[5] } xmlns="urn:xmpp:jingle:apps:rtp:ssma:0">
                            <parameter name="cname" value={ `cname-${this._id}` }/>
                            <parameter name="msid" value={ `video-stream-${this._id} video-track-${this._id}` }/>
                        </source>
                        <ssrc-group semantics="FID" xmlns="urn:xmpp:jingle:apps:rtp:ssma:0">
                            <source ssrc={ssrc.video[0]}/>
                            <source ssrc={ssrc.video[1]}/>
                        </ssrc-group>
                        <ssrc-group semantics="FID" xmlns="urn:xmpp:jingle:apps:rtp:ssma:0">
                            <source ssrc={ssrc.video[2]}/>
                            <source ssrc={ssrc.video[4]}/>
                        </ssrc-group>
                        <ssrc-group semantics="FID" xmlns="urn:xmpp:jingle:apps:rtp:ssma:0">
                            <source ssrc={ssrc.video[3]}/>
                            <source ssrc={ssrc.video[5]}/>
                        </ssrc-group>
                        <ssrc-group semantics="SIM" xmlns="urn:xmpp:jingle:apps:rtp:ssma:0">
                            <source ssrc={ssrc.video[0]}/>
                            <source ssrc={ssrc.video[2]}/>
                            <source ssrc={ssrc.video[3]}/>
                        </ssrc-group>
                        <rtcp-mux/>
                        <rtp-hdrext id="3" uri="http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time" xmlns="urn:xmpp:jingle:apps:rtp:rtp-hdrext:0"/>
                        <rtp-hdrext id="5" uri="http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01" xmlns="urn:xmpp:jingle:apps:rtp:rtp-hdrext:0"/>
                    </description>
                    <transport pwd="mbXdhJhxCTpxn72IN15DfPPy" ufrag="ax9g" xmlns="urn:xmpp:jingle:transports:ice-udp:1">
                        <fingerprint hash="sha-256" setup="passive" xmlns="urn:xmpp:jingle:apps:dtls:0">9F:16:C2:FF:E7:94:E4:70:83:FF:EE:F3:DA:92:C0:B2:31:97:50:B6:E4:EC:39:B0:00:30:89:94:2D:23:16:ED</fingerprint>
                    </transport>
                </content>
            </jingle>
        </iq>;

        try {
            this._debug('Sending session-accept.');
            this._xmpp.iqCaller.request(sessionAccept, 30000);
        } catch (err) {
            log(`${this}: failed to send session-accept: ${err}`);
        }
    }

    _startPing() {
        this._pingInterval = setInterval(() => this._sendPing(), 10000);
    }

    _sendPing() {
        try {
            this._xmpp.iqCaller.request(
                <iq to={this._config.domain} type="get" xmlns="jabber:client">
                    <ping xmlns="urn:xmpp:ping"/>
                </iq>,
                30000
            ).then(() => {
                this._xmpp.streamManagement.inbound += 1;
            });
        } catch (err) {
            log(`${this}: failed to send ping: ${err}`);
        }
    }

    _stopPing() {
        clearInterval(this._pingInterval);
    }

    _getConferenceRequestUrl() {
        const { conferenceRequestTarget, room } = this._config;
        if (conferenceRequestTarget &&
            (conferenceRequestTarget.startsWith('http://') || conferenceRequestTarget.startsWith('https://'))) {
            return `${conferenceRequestTarget}?room=${room}`;
        }
    }

    async disconnect() {
        this._debug('Disconnecting.');
        this._stopPing();
        try {
            await leaveMuc(this._xmpp, this._mucJID);
            await this._xmpp.send(<presence type="unavailable"/>);
        } catch (err) {
            log(`${this}: failed to send unavailable presence: ${err}`);
        }
        await disconnect(this._xmpp);
    }
}
