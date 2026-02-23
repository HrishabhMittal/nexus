import express from 'express';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { NexusServer } from '../dist/server/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);

app.use(express.static(join(__dirname, 'game/public')));
app.use('/dist', express.static(join(__dirname, '../dist')));

const hooks = {
    getInitialPlayerState: () => ({
        x: Math.floor(Math.random() * 700) + 50,
        y: Math.floor(Math.random() * 500) + 50,
        color: `hsl(${Math.floor(Math.random() * 360)}, 80%, 50%)`,
        intent: { UP: false, DOWN: false, LEFT: false, RIGHT: false }
    }),
    
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

new NexusServer(hooks, 9208);

httpServer.listen(8080, () => {
    console.log('HTTP Static Server running at http://localhost:8080');
    console.log('Geckos WebRTC Signaling running on port 9208');
});
