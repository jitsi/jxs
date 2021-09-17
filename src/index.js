


import Participant from './Participant';
import { randomInt } from './util';

const path = require('path');
const fs = require('fs');
const {
    service,
    domain
} = JSON.parse(fs.readFileSync(path.resolve(process.argv[2])));
const muc = `conference.${domain}`;
const focus = `focus.${domain}`;
const roomPrefix = 'jxs-test-' + Date.now() + randomInt(0, 10000);
const numberOfRooms = Number(process.argv[3]);
const numberOfParticipants = Number(process.argv[4]);
// by default we space participant's join by 100 ms.
const delay = Number(process.argv[5]) || 100;
if (!numberOfRooms || isNaN(numberOfRooms)) {
    process.exit(1);
}

if (!numberOfParticipants || isNaN(numberOfParticipants)) {
    process.exit(2);
}

const participants = {};

for (let j = 0; j < numberOfRooms; j++) {
    const roomName = `${roomPrefix}-${j}`;
    console.log(`Room name:${roomName}`);

    participants[roomName] = [];
    for (let i = 0; i < numberOfParticipants; i++) {
        const participant = new Participant({
            service,
            domain,
            room: roomName,
            // enableDebug: true,
            focus,
            muc
        });
        participants[roomName].push(participant);
        if (!delay) {
            participant.join();
        } else {
            setTimeout(() => participant.join(), i * delay);
        }
    }
}
let cleanedUp = false;

function cleanup() {
    if (cleanedUp) {
        return;
    }
    cleanedUp = true;

    for (const room in participants) {
        participants[room].every(p => p.disconnect());
    }
}

process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);

