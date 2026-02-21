import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { NexusServer } from '../dist/server/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

app.use(express.static(join(__dirname, 'public')));
app.use('/dist', express.static(join(__dirname, '../dist')));

const hooks = {
    getInitialPlayerState: () => ({
        x: Math.floor(Math.random() * 700) + 50,
        y: Math.floor(Math.random() * 500) + 50,
        color: `hsl(${Math.floor(Math.random() * 360)}, 80%, 50%)`
    }),
    applyInput: (state, playerInput) => {
        const newState = { ...state };
        const speed = 10;
        
        if (playerInput.input === 'UP') newState.y -= speed;
        if (playerInput.input === 'DOWN') newState.y += speed;
        if (playerInput.input === 'LEFT') newState.x -= speed;
        if (playerInput.input === 'RIGHT') newState.x += speed;
        
        return newState;
    },
    syncState: (state) => state
};

new NexusServer(io, hooks);

httpServer.listen(3000, () => {
    console.log('Test Server running at http://localhost:3000');
});
