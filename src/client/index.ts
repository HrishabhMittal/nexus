import { io, Socket } from "socket.io-client";
import type { WorldState, PlayerInput, ClientInputPayload } from "../core/index.js";

export class NexusClient<State, Input> {
    private socket: Socket;
    private state: WorldState<State> | null = null;
    private updateState: (newInput: PlayerInput<Input>, oldState: WorldState<State>) => void;
    
    private pendingInputs: PlayerInput<Input>[] = [];

    constructor(serverUrl: string, updateState: (newInput: PlayerInput<Input>, oldState: WorldState<State>) => void) {
        this.socket = io(serverUrl);
        this.updateState = updateState;
        this.setupListeners();
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
                    this.updateState(pending, this.state);
                }
            }
        });

        this.socket.on("stateUpdate", (newInput: PlayerInput<Input>) => {
            if (this.state) this.updateState(newInput, this.state);
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

        if (this.state) {
            this.updateState(playerInput, this.state);
        }
    }

    public getState() {
        return this.state;
    }

    public getPlayerId() {
        return this.socket.id;
    }
}
