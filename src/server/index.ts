import { Server, Socket } from "socket.io";
import type { GameHooks, PlayerInput, WorldState, ClientInputPayload } from "../core/index.js";

export class NexusServer<State, Input> {
    private io: Server;
    private hooks: GameHooks<State, Input>;
    private state: WorldState<State> = {
        players: {},
        timestamp: 0
    };

    constructor(io: Server, hooks: GameHooks<State, Input>) {
        this.io = io;
        this.hooks = hooks;
        setInterval(() => this.broadcastState(), 100);
        this.setupRoutes();
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
                socket.broadcast.emit("stateUpdate", playerInput);
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
            player.data = this.hooks.applyInput(player.data, input);
            player.lastProcessedTimestamp = input.timestamp;
        }
    }

    private broadcastState() {
        this.state.timestamp = Date.now();
        this.io.emit("stateSync", this.state);
    }
}
