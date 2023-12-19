export function randomInt(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function generateSsrc() {
	return randomInt(1, 0xffffffff);
}

export function log(...args) {
    console.log(`${new Date().toISOString()} ${args.join('')}`)
}