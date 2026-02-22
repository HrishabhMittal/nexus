import { Server, Socket } from "socket.io";
import type { GameHooks, PlayerInput, WorldState, ClientInputPayload } from "../core/index.js";

export class NexusServer<State, Input> {
    private io: Server;
    private hooks: GameHooks<State, Input>;
    private state: WorldState<State> = {
        players: {},
        timestamp: 0
    };
    private lastTickTime: number;
    private inputBuffer: PlayerInput<Input>[];
    private buffered: number;
    constructor(io: Server, hooks: GameHooks<State, Input>) {
        this.io = io;
        this.hooks = hooks;
        this.lastTickTime = Date.now();
        this.inputBuffer = new Array(200);
        this.buffered = 0;
        setInterval(() => this.tick(), 1000 / 60);
        setInterval(() => this.broadcastState(), 100);
        
        this.setupRoutes();
    }
    private flushInputBuffer() {
        if (this.buffered > 0) {
            const batch = this.inputBuffer.slice(0, this.buffered);
            this.io.emit("stateUpdate", batch);
            this.buffered = 0;
        }
    }
    private tick() {
        const startTime = performance.now();
        const now = Date.now();
        const deltaTime = (now - this.lastTickTime) / 1000;
        this.lastTickTime = now;
        
        for (const playerId in this.state.players) {
            const player = this.state.players[playerId];
            if (!player) continue; 
            player.data = this.hooks.updateState(player.data, deltaTime);
        }
        this.flushInputBuffer();
        const executionTime = performance.now() - startTime;
        if (executionTime > 5) {
            console.warn(`[Performance Warning] Tick took ${executionTime.toFixed(2)}ms`);
        } else {
            console.log(`[Performance Stable] Tick took ${executionTime.toFixed(2)}ms`);
        }
    }

    private setupRoutes() {
        this.io.on("connection", (socket: Socket) => {
            console.log(`Player connected: ${socket.id}`);
            socket.emit("stateSync", this.state);
            this.state.players[socket.id] = {
                id: socket.id,
                data: this.hooks.getInitialPlayerState(socket.id),
                lastProcessedTimestamp: 0
            };

            socket.on("input", (payload: ClientInputPayload<Input>) => {
                const playerInput: PlayerInput<Input> = { 
                    id: socket.id, 
                    input: payload.input,
                    timestamp: payload.timestamp
                };
                
                this.handleInput(socket.id, playerInput);
                this.inputBuffer[this.buffered++]=playerInput;
                if (this.buffered>=200) {
                    this.flushInputBuffer();
                }
            });

            socket.on("disconnect", () => {
                console.log(`Player disconnected: ${socket.id}`);
                delete this.state.players[socket.id];
            });
        });
    }

    private handleInput(playerId: string, input: PlayerInput<Input>) {
        const player = this.state.players[playerId];
        if (!player) return;

        if (input.timestamp > player.lastProcessedTimestamp) {
            this.hooks.applyInput(player.data, input);
            player.lastProcessedTimestamp = input.timestamp;
        }
    }

    private broadcastState() {
        this.state.timestamp = Date.now();
        this.io.emit("stateSync", this.state);
    }
}
