import Participant from '../Participant';
import { loadConfig } from '../lib/config';
import { randomInt, log } from '../util';

const { config } = loadConfig({
    numberOfRooms: 1,
    numberOfParticipants: 2,
    delay: 0,
    joinMuc: true,
});

config.roomPrefix = config.roomPrefix || 'jxs-test-' + randomInt(0, 10000);
config.conferenceRequestTarget = config.conferenceRequestTarget || `focus.${config.domain}`;

log(`Starting with config:\n${JSON.stringify(config, null, 2)}`);

const rooms = {};
let numberOfJoins = 0;
const startTime = new Date();

const onJoined = function () {
    numberOfJoins++;
    if (numberOfJoins === config.numberOfParticipants * config.numberOfRooms) {
        log(`All participants joined in ${(new Date() - startTime) / 1000} seconds.`);
        if (config.duration) {
            log(`Will disconnect in ${config.duration} seconds.`);
            setTimeout(cleanup, config.duration * 1000);
        }
    }
};

let numberOfOffline = 0;
const onOffline = function () {
    numberOfOffline++;
    if (numberOfOffline === config.numberOfParticipants * config.numberOfRooms) {
        log('All participants offline. Exiting.');
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
        setTimeout(() => participant.join(), i * config.delay);
    }
}

let cleanedUp = false;
function cleanup() {
    if (cleanedUp) return;
    cleanedUp = true;
    for (const room in rooms) {
        rooms[room].forEach(p => p.disconnect());
    }
}

process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);
