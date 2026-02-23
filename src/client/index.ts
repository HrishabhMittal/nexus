import geckos, { type ClientChannel } from '@geckos.io/client';
import type { WorldState, PlayerInput, ClientInputPayload, GameHooks } from "../core/index.js";

export class NexusClient<State, Input> {
    private channel: ClientChannel;
    private state: WorldState<State> | null = null;
    private hooks: GameHooks<State, Input>;
    
    private pendingInputs: PlayerInput<Input>[] = [];
    private lastTickTime: number;

    constructor(url: string, hooks: GameHooks<State, Input>, port: number = 9208) {
        this.channel = geckos({ url, port }); 
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
            if (!player) continue; 
            player.data = this.hooks.updateState(player.data, deltaTime);
        }
    }

    private setupListeners() {
        this.channel.onConnect((error) => {
            if (error) {
                console.error("Geckos connection error:", error.message);
                return;
            }
            console.log("Connected to Game Server with ID:", this.channel.id);
        });
        
        this.channel.onRaw((data: unknown) => {
            if (!data || typeof data === 'string') return;
            
            const messageString = new TextDecoder().decode(data as any);
            
            const parsed = JSON.parse(messageString);
                   
            if (parsed.e === "S") {
                const newState = parsed.d as WorldState<State>;
                this.state = newState;
                
                const myId = this.channel.id;
                if (!myId) return;

                const myPlayer = this.state.players[myId];
                if (myPlayer) {
                    const lastProcessed = myPlayer.lastProcessedTimestamp;
                    
                    this.pendingInputs = this.pendingInputs.filter(p => p.timestamp > lastProcessed);
                    
                    for (const pending of this.pendingInputs) {
                        this.hooks.applyInput(myPlayer.data, pending);
                    }
                }
            } 
            else if (parsed.e === "U") {
                const newInputs = parsed.d as PlayerInput<Input>[];
                if (!this.state) return;
                
                for (const newInput of newInputs) {
                    if (newInput.id === this.channel.id) continue;
                    const player = this.state.players[newInput.id];
                    if (player) {
                        this.hooks.applyInput(player.data, newInput);
                    }
                }
            }
        });

        this.channel.onDisconnect(() => {
            console.log("Disconnected from Game Server");
            this.state = null;
        });
    }

    public sendInput(input: Input) {
        const myId = this.channel.id;
        if (!myId) return;

        const timestamp = Date.now();
        const payload: ClientInputPayload<Input> = { input, timestamp };
        
        const rawMessage = JSON.stringify({ e: "I", d: payload });
        
        const binary = new TextEncoder().encode(rawMessage);
        this.channel.raw.emit(binary);
        
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
        return this.channel.id;
    }
}
