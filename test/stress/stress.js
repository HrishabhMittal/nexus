import { NexusClient } from '../../dist/client/index.js';

const SERVER_URL = 'http://localhost:8080';
const NUM_CLIENTS = 150;
const INPUT_INTERVAL_MS = 50;

const headlessHooks = {
    getInitialPlayerState: () => ({ x: 0, y: 0, intent: {} }),
    applyInput: (state, playerInput) => {
        state.intent = playerInput.input;
    },
    updateState: (state, deltaTime) => {
        return state; 
    }
};
console.log(`Spawning ${NUM_CLIENTS} headless clients...`);
const clients = [];

for (let i = 0; i < NUM_CLIENTS; i++) {
    const client = new NexusClient(SERVER_URL, headlessHooks);
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
    
    console.log(`[Stress Test] Active Clients: ${activeConnections}/${NUM_CLIENTS} | Uptime: ${(now - lastLog) / 1000}s`);
}, 2000);
