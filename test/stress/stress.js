import { NexusClient } from '../../dist/client/index.js';

import { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate } from 'node-datachannel/polyfill';
globalThis.RTCPeerConnection = RTCPeerConnection;
globalThis.RTCSessionDescription = RTCSessionDescription;
globalThis.RTCIceCandidate = RTCIceCandidate;

const SERVER_URL = 'http://127.0.0.1';
const GECKOS_PORT = 9208;
const NUM_CLIENTS = 100;
const INPUT_INTERVAL_MS = 50;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const headlessHooks = {
    getInitialPlayerState: () => ({ x: 0, y: 0, intent: {} }),
    applyInput: (state, playerInput) => {
        state.intent = playerInput.input;
    },
    updateState: (state, deltaTime) => {
        return state; 
    },

    encodeState: (state) => encoder.encode(JSON.stringify(state)),
    decodeState: (buffer) => JSON.parse(decoder.decode(buffer)),
    encodeInput: (input) => encoder.encode(JSON.stringify(input)),
    decodeInput: (buffer) => JSON.parse(decoder.decode(buffer))
};

console.log(`Spawning ${NUM_CLIENTS} headless clients...`);
const clients = [];

for (let i = 0; i < NUM_CLIENTS; i++) {
    const client = new NexusClient(SERVER_URL, headlessHooks, GECKOS_PORT);
    clients.push(client);
    
    setInterval(() => {
        const intents = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
        const randomIntent = intents[Math.floor(Math.random() * intents.length)];
        
        const input = { UP: false, DOWN: false, LEFT: false, RIGHT: false };
        input[randomIntent] = true;
        
        client.sendInput(input);
    }, INPUT_INTERVAL_MS);
}

let lastLog = Date.now();
setInterval(() => {
    const now = Date.now();
    const activeConnections = clients.filter(c => c.getState() !== null).length;
    
    console.log(`[Stress Test] Active WebRTC Channels: ${activeConnections}/${NUM_CLIENTS} | Uptime: ${(now - lastLog) / 1000}s`);
}, 2000);
