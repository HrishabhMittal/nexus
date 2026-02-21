import { NexusClient } from '/dist/client/index.js';
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const updateState = (playerInput, worldState) => {
    const player = worldState.players[playerInput.id];
    if (!player) return;
    
    const speed = 10;
    if (playerInput.input === 'UP') player.data.y -= speed;
    if (playerInput.input === 'DOWN') player.data.y += speed;
    if (playerInput.input === 'LEFT') player.data.x -= speed;
    if (playerInput.input === 'RIGHT') player.data.x += speed;
};

const client = new NexusClient(window.location.origin, updateState);

window.addEventListener('keydown', (e) => {
    const map = { ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT' };
    if (map[e.key]) {
        e.preventDefault();
        client.sendInput(map[e.key]);
    }
});

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const state = client.getState();
    const myId = client.getPlayerId();

    if (state && state.players) {
        for (const id in state.players) {
            const p = state.players[id].data;
            
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, 40, 40);
            
            if (id === myId) {
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 3;
                ctx.strokeRect(p.x, p.y, 40, 40);
            }
        }
    }
    requestAnimationFrame(render);
}

render();
