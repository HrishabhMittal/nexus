import { NexusClient } from '/dist/client/index.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const hooks = {
    getInitialPlayerState: () => ({}),
    applyInput: (state, playerInput) => {
        state.intent = playerInput.input;
    },
    updateState: (state, deltaTime) => {
        const newState = { ...state };
        const speed = 200;
        
        if (newState.intent?.UP) newState.y -= speed * deltaTime;
        if (newState.intent?.DOWN) newState.y += speed * deltaTime;
        if (newState.intent?.LEFT) newState.x -= speed * deltaTime;
        if (newState.intent?.RIGHT) newState.x += speed * deltaTime;
        
        return newState;
    }
};

const geckosUrl = `${window.location.protocol}//${window.location.hostname}`;
const client = new NexusClient(geckosUrl, hooks);

const currentIntent = { UP: false, DOWN: false, LEFT: false, RIGHT: false };

window.addEventListener('keydown', (e) => {
    const map = { ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT' };
    if (map[e.key] && !currentIntent[map[e.key]]) {
        e.preventDefault();
        currentIntent[map[e.key]] = true;
        client.sendInput({ ...currentIntent });
    }
});

window.addEventListener('keyup', (e) => {
    const map = { ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT' };
    if (map[e.key]) {
        e.preventDefault();
        currentIntent[map[e.key]] = false;
        client.sendInput({ ...currentIntent });
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
