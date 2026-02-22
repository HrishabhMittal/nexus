import { io, Socket } from "socket.io-client";
import type { WorldState, PlayerInput, ClientInputPayload, GameHooks } from "../core/index.js";

export class NexusClient<State, Input> {
    private socket: Socket;
    private state: WorldState<State> | null = null;
    private hooks: GameHooks<State, Input>;
    
    private pendingInputs: PlayerInput<Input>[] = [];
    private lastTickTime: number;

    constructor(serverUrl: string, hooks: GameHooks<State, Input>) {
        this.socket = io(serverUrl);
        this.hooks = hooks;
        this.lastTickTime = Date.now();
        this.setupListeners();
        setInterval(() => this.tick(), 1000 / 60);
    }

    private tick() {
        if (!this.state) return;
        const now = Date.now();
        const deltaTime = (now - this.lastTickTime) / 1000;
        this.lastTickTime = now;

        for (const playerId in this.state.players) {
            const player = this.state.players[playerId];
            if (!player) continue; // lsp bruh
            player.data = this.hooks.updateState(player.data, deltaTime);
        }
    }

    private setupListeners() {
        this.socket.on("connect", () => {
            console.log("Connected to Game Server");
        });
        
        this.socket.on("stateSync", (newState: WorldState<State>) => {
            this.state = newState;
            const myId = this.socket.id;
            if (!myId) return;

            const myPlayer = this.state.players[myId];
            if (myPlayer) {
                const lastProcessed = myPlayer.lastProcessedTimestamp;
                
                this.pendingInputs = this.pendingInputs.filter(p => p.timestamp > lastProcessed);
                
                for (const pending of this.pendingInputs) {
                    this.hooks.applyInput(myPlayer.data, pending);
                }
            }
        });

        this.socket.on("stateUpdate", (newInputs: PlayerInput<Input>[]) => {
            if (!this.state) return;
            for (const newInput of newInputs) {
                if (newInput.id === this.socket.id) continue;
                const player = this.state.players[newInput.id];
                if (player) {
                    this.hooks.applyInput(player.data, newInput);
                }
            }
        });
    }

    public sendInput(input: Input) {
        const timestamp = Date.now();
        const payload: ClientInputPayload<Input> = { input, timestamp };
        const myId = this.socket.id;
        if (!myId) return;
        
        this.socket.emit("input", payload);
        const playerInput: PlayerInput<Input> = { id: myId, input, timestamp };
        this.pendingInputs.push(playerInput);

        if (this.state && this.state.players[myId]) {
            this.hooks.applyInput(this.state.players[myId].data, playerInput);
        }
    }

    public getState() {
        return this.state;
    }

    public getPlayerId() {
        return this.socket.id;
    }
}
