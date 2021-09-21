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
const joinRates = {};
const joinAttemptRates = {};

let numberOfJoins = 0;
const onJoined = function () {
    const currentSecond = new Date().getTime()/1000 | 0;
    numberOfJoins++;

    console.log('joined:' + numberOfJoins);

    if (!joinRates[currentSecond]) {
        joinRates[currentSecond] = 1;
    } else {
        joinRates[currentSecond]++;
    }

    if (numberOfJoins === numberOfParticipants) {
        // this is the last one
        console.log('joinAttemptRates:', joinAttemptRates);
        console.log('joinRate:', joinRates);
    }
};

let numberOfOffline = 0;
const onOffline = function () {
    numberOfOffline++;

    if (numberOfOffline === numberOfParticipants) {
        process.exit(0);
    }
};

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
        participant.on('joined', onJoined);
        participant.on('offline', onOffline);

        participants[roomName].push(participant);
        if (!delay) {
            participant.join();
        } else {
            setTimeout(() => {
                const currentSecond = new Date().getTime()/1000 | 0;
                if (!joinAttemptRates[currentSecond]) {
                    joinAttemptRates[currentSecond] = 1;
                } else {
                    joinAttemptRates[currentSecond]++;
                }

                participant.join();
            }, i * delay);
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

