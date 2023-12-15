import Participant from './Participant';
import { randomInt, log } from './util';

const path = require('path');
const fs = require('fs');

if (process.argv.length < 3) {
    log('Usage: node main.js <config-file> [number-of-conferences] [number-of-participants-per-conference]');
    process.exit(1);
}

let config;
try {
    config = JSON.parse(fs.readFileSync(path.resolve(process.argv[2])));
} catch (error) {
    log(`Error parsing config file (${process.argv[2]}): ${error}`);
    process.exit(1);
}

if (!config.domain) {
    log(`No domain specified in config file ${process.argv[2]}`);
    process.exit(1);
}

config.service = config.service || `wss://${config.domain}/xmpp-websocket`;
config.muc = config.muc || `conference.${config.domain}`;
config.roomPrefix = config.roomPrefix || 'jxs-test-' + randomInt(0, 10000);
config.numberOfRooms = Number(process.argv[3]) || config.numberOfRooms || 1;
config.numberOfParticipants = Number(process.argv[4]) || config.numberOfParticipants || 2;
config.delay = config.delay || 0;
config.enableDebug = config.enableDebug || false;
config.enableXmppLog = config.enableXmppLog || false;
config.conferenceRequestTarget = config.conferenceRequestTarget || `focus.${config.domain}`;
log(`Running with config: ${JSON.stringify(config,null, 2)}`);

const rooms = {};

let numberOfJoins = 0;
const startTime = new Date();
const onJoined = function () {
    numberOfJoins++;
    if (numberOfJoins == config.numberOfParticipants * config.numberOfRooms) {
        log(`All joined, took ${(new Date() - startTime)/1000} seconds.`);
        if (config.duration) {
            log(`Setting timeout in ${config.duration} seconds.`)
            setTimeout(cleanup, config.duration * 1000);
        }
    }
}
let numberOfOffline = 0;
const onOffline = function () {
    numberOfOffline++;

    if (numberOfOffline === config.numberOfParticipants * config.numberOfRooms) {
        log('All offline, exiting.');
        process.exit(0);
    }
};

for (let j = 0; j < config.numberOfRooms; j++) {
    const roomName = `${config.roomPrefix}-${j}`;
    const participantConfig = { ...config, room: roomName };

    rooms[roomName] = [];
    for (let i = 0; i < config.numberOfParticipants; i++) {

        const participant = new Participant(`${j}-${i}`, participantConfig);
        participant.on('joined', onJoined);
        participant.on('offline', onOffline);

        rooms[roomName].push(participant);
        setTimeout(() => {
            participant.join();
        }, i * config.delay);
    }
}
let cleanedUp = false;

function cleanup() {
    if (cleanedUp) {
        return;
    }
    cleanedUp = true;

    for (const room in rooms) {
        rooms[room].every(p => p.disconnect());
    }
}

process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);

