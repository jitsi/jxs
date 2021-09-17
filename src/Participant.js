/** @jsx xml */
import EventEmitter from 'events';
import { client, xml } from '@xmpp/client';
import debug from '@xmpp/debug';
import { generateSsrc } from './util'

let id = 1;

export default class Participant extends EventEmitter {
    constructor(config = {}) {
        super();
        this._id = id++;
        this._config = config;
        const { service, room, domain, enableDebug = false } = this._config;
        this._xmpp = client({
            service: `${service}?room=${room}`,
            domain
        });

        if (enableDebug) {
            debug(this._xmpp, true);
        }

        this._onError = this._onError.bind(this);
        this._onOffline = this._onOffline.bind(this);
        this._onStanza = this._onStanza.bind(this);
        this._onError = this._onError.bind(this);
        this._onOnline = this._onOnline.bind(this);
        this.toString = this.toString.bind(this);
        this._onJingle = this._onJingle.bind(this);
        this._startPing = this._startPing.bind(this);
        this._stopPing = this._stopPing.bind(this);
        this._xmpp.iqCallee.set('urn:xmpp:jingle:1', 'jingle', this._onJingle);

        this._xmpp.on("error", this._onError);
        this._xmpp.on("offline", this._onOffline);
        this._xmpp.on("stanza", this._onStanza);
        this._xmpp.on("online", this._onOnline);
    }


    _onError(error) {
        console.error(`${this} error:`, error);
        this.emit('error', error);
    }

    _onOffline() {
        console.log(`${this} is offline!`);
        this.emit('offline');
    }

    async _onOnline(address) {
        console.log(`${this} is online!`);
        this.emit('online', address);
        this._jid = address;
        this._machineID = this._jid.local;
        this._roomNick = this._jid.local.slice(0, 8);
        const { room, muc } = this._config;
        this._mucJID = `${room}@${muc}/${this._roomNick}`;
        try {
            await this._inviteJicofo();
            await this._joinMuc();
            this._startPing();
        } catch (error) {
            console.error(`${this} error:`, error);
        }
        this.emit('join-finished');
    }

    _onStanza(stanza) {
        this.emit('stanza', stanza);
    }

    async _inviteJicofo() {
        console.log(`${this} is inviting jicofo to the room`);
        const { focus, room, muc } = this._config;
        const iq = <iq to = { focus } type="set" xmlns="jabber:client">
            <conference machine-uid = { this._machineID }
                room = { `${room}@${muc}` }
                xmlns="http://jitsi.org/protocol/focus">
                    <property name="channelLastN" value="-1"/>
                    <property name="disableRtx" value="false"/>
                    <property name="enableTcc" value="true"/>
                    <property name="enableRemb" value="true"/>
                    <property name="enableLipSync" value="false"/>
                    <property name="startBitrate" value="800"/>
                    <property name="octo" value="true"/>
                    <property name="openSctp" value="false"/>
                    <property name="startAudioMuted" value="999"/>
                    <property name="startVideoMuted" value="999"/>
                    <property name="stereo" value="true"/>
                    <property name="useRoomAsSharedDocumentName" value="false"/>
            </conference>
        </iq>;
        try {
            await this._xmpp.iqCaller.request(iq, 30000 );
        } catch (error) {
            console.error(error);
        }
    }

    async _joinMuc() {
        const { focus, room, muc } = this._config;
        console.log(`${this} is joining!`);
        try {
            await this._xmpp.send(<presence
                to = { this._mucJID }
                xmlns="jabber:client">
                    <x xmlns="http://jabber.org/protocol/muc"/>
                    <stats-id>Adeline-2mY</stats-id>
                    <region id="us-east-1" xmlns="http://jitsi.org/jitsi-meet"/>
                    <c hash="sha-1" node="http://jitsi.org/jitsimeet" ver="cvjWXufsg4xT62Ec2mlATkFZ9lk=" xmlns="http://jabber.org/protocol/caps"/>
                    <jitsi_participant_region>us-east-1</jitsi_participant_region>
                    <avatar-id>e8b7ee7bbac3a53f14a711b538526bf3</avatar-id>
                    <nick xmlns="http://jabber.org/protocol/nick"/>
                    <audiomuted xmlns="http://jitsi.org/jitmeet/audio">false</audiomuted>
                    <videoType xmlns="http://jitsi.org/jitmeet/video">camera</videoType>
                    <videomuted xmlns="http://jitsi.org/jitmeet/video">false</videomuted>
                </presence>);
        } catch (error) {
            console.error()

        }
    }

    async _sendAudioMute(mute) {
        console.log(`${this} send mute ${mute}!`);
        try {
            await this._xmpp.send(<presence
                to = { this._mucJID }
                xmlns="jabber:client">
                    <stats-id>Adeline-2mY</stats-id>
                    <region id="us-east-1" xmlns="http://jitsi.org/jitsi-meet"/>
                    <c hash="sha-1" node="http://jitsi.org/jitsimeet" ver="cvjWXufsg4xT62Ec2mlATkFZ9lk=" xmlns="http://jabber.org/protocol/caps"/>
                    <jitsi_participant_region>us-east-1</jitsi_participant_region>
                    <avatar-id>e8b7ee7bbac3a53f14a711b538526bf3</avatar-id>
                    <nick xmlns="http://jabber.org/protocol/nick"/>
                    <audiomuted xmlns="http://jitsi.org/jitmeet/audio">{ mute }</audiomuted>
                    <videoType xmlns="http://jitsi.org/jitmeet/video">camera</videoType>
                    <videomuted xmlns="http://jitsi.org/jitmeet/video">false</videomuted>
                </presence>);
        } catch (error) {
            console.error()
        }
    }
    async _sendMessage(txt) {
        console.log(`${this} send msg ${txt}!`);
        try {
            await this._xmpp.send(<message
                to = { this._mucJID }
                type="groupchat"
                xmlns="jabber:client">
                <body>{txt}</body>
                </message>);
        } catch (error) {
            console.error()
        }
    }

    toString() {
        return `Participant ${this._id} from ${this._config.room} room: `;
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
        const sessionAccept = <iq to = { iq.attrs.from } type="set" xmlns="jabber:client">
            <jingle
                action="session-accept"
                initiator = { iq.attrs.from }
                responder = { this._jid }
                sid = { jingle.attrs.sid }
                xmlns="urn:xmpp:jingle:1">
                <group semantics="BUNDLE" xmlns="urn:xmpp:jingle:apps:grouping:0">
                    <content name="audio"/>
                    <content name="video"/>
                </group>
                <content creator="responder" name="audio" senders="both">
                    <description media="audio" ssrc={ ssrc.audio } xmlns="urn:xmpp:jingle:apps:rtp:1">
                        <payload-type channels="2" clockrate="48000" id="111" name="opus">
                            <parameter name="minptime" value="10"/>
                            <parameter name="useinbandfec" value="1"/>
                            <rtcp-fb type="transport-cc" xmlns="urn:xmpp:jingle:apps:rtp:rtcp-fb:0"/>
                        </payload-type>
                        <payload-type channels="1" clockrate="16000" id="103" name="ISAC"/>
                        <payload-type channels="1" clockrate="32000" id="104" name="ISAC"/>
                        <payload-type channels="1" clockrate="8000" id="126" name="telephone-event"/>
                        <source ssrc={ ssrc.audio } xmlns="urn:xmpp:jingle:apps:rtp:ssma:0">
                            <parameter name="cname" value={ `cname-${this._id}` } />
                            <parameter name="msid" value={ `audio-stream-${this._id} audio-track-${this._id}` }/>
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
                    <description media="video" ssrc={ ssrc.video[0] } xmlns="urn:xmpp:jingle:apps:rtp:1">
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
                            <source ssrc={ ssrc.video[0] }/>
                            <source ssrc={ ssrc.video[1] }/>
                            </ssrc-group>
                        <ssrc-group semantics="FID" xmlns="urn:xmpp:jingle:apps:rtp:ssma:0">
                            <source ssrc={ ssrc.video[2] }/>
                            <source ssrc={ ssrc.video[4] }/>
                        </ssrc-group>
                        <ssrc-group semantics="FID" xmlns="urn:xmpp:jingle:apps:rtp:ssma:0">
                            <source ssrc={ ssrc.video[3] }/>
                            <source ssrc={ ssrc.video[5] }/>
                        </ssrc-group>
                        <ssrc-group semantics="SIM" xmlns="urn:xmpp:jingle:apps:rtp:ssma:0">
                            <source ssrc={ ssrc.video[0] }/>
                            <source ssrc={ ssrc.video[2] }/>
                            <source ssrc={ ssrc.video[3] }/>
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

        try{
            console.log(`${this} sends session accept`);
            this._xmpp.iqCaller.request(sessionAccept, 30000);
        } catch (error) {
            console.error(error);
        }
    }

    _onJingle(ctx) {
        const { element, stanza } = ctx;
        switch(element.attrs.action) {
            case 'session-initiate':
                console.log(`${this} received session initiate`);
                setTimeout(async () => {
                    this._sendSessionAccept(element, stanza);
                }, 10);
                return true;
            break;
            default:
                return true;
        }
    }

    join() {
        this._xmpp.start().catch(this._onError);
    }

    _startPing() {
        this._pingInterval = setInterval(() => {
            this._sendPing();
        }, 10000);
    }

    _sendPing() {
        try {
            this._xmpp.iqCaller.request(<iq  to={this._config.domain} type="get" xmlns="jabber:client">
                <ping xmlns="urn:xmpp:ping"/>
            </iq>, 30000).then(() => {
                // count the ping responses for the stream management so we can ack them
                this._xmpp.streamManagement.inbound += 1;
            });
        } catch(error) {
            console.error(error);
        }
    }

    _stopPing() {
        clearInterval(this._pingInterval);
    }

    async disconnect() {
        console.log(`${this} is disconnecting`);
        this._stopPing();
        try {
            await this._xmpp.send(<presence from = { this._jid } to={ this._mucJID } type = 'unavailable'/>);
            await this._xmpp.send(<presence type = "unavailable" />);
        } catch (error) {
            console.error(error);
        }
        try {
            await this._xmpp.stop();
        } catch(error) {
            console.error(error);
        }
    }

}
