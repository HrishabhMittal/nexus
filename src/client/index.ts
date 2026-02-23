import geckos, { type ClientChannel } from '@geckos.io/client';
import type { WorldState, PlayerInput, ClientInputPayload, GameHooks } from "../core/index.js";
import { 
    ServerMessage, 
    ClientMessage, 
    ServerMessage_Type, 
    ClientMessage_Type 
} from "../schema/nexus.js";

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
            if (!(data instanceof ArrayBuffer) && !ArrayBuffer.isView(data)) return;
            
            try {
                const buffer = new Uint8Array(data as ArrayBuffer);
                const parsed = ServerMessage.decode(buffer);
                
                if (parsed.type === ServerMessage_Type.SYNC && parsed.state) {
                    const newPlayers: Record<string, any> = {};
                    
                    for (const pid in parsed.state.players) {
                        const p = parsed.state.players[pid];
                        if (!p) continue;
                        newPlayers[pid] = {
                            id: p.id,
                            data: this.hooks.decodeState(p.data),
                            lastProcessedTimestamp: p.lastProcessedTimestamp
                        };
                    }
                    
                    this.state = {
                        players: newPlayers,
                        timestamp: parsed.state.timestamp
                    };
                    
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
                else if (parsed.type === ServerMessage_Type.UPDATE && parsed.update) {
                    if (!this.state || !parsed.update.inputs) return;
                    
                    for (const rawInput of parsed.update.inputs) {
                        if (rawInput.id === this.channel.id) continue;
                        
                        const player = this.state.players[rawInput.id];
                        if (player) {
                            const decodedInput = this.hooks.decodeInput(rawInput.input);
                            this.hooks.applyInput(player.data, {
                                id: rawInput.id,
                                input: decodedInput,
                                timestamp: rawInput.timestamp
                            });
                        }
                    }
                }
            } catch (err) {
                console.error("Failed to parse ServerMessage:", err);
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
        const encodedInput = this.hooks.encodeInput(input);
        
        const message = ClientMessage.create({
            type: ClientMessage_Type.INPUT,
            input: {
                input: encodedInput,
                timestamp: timestamp
            }
        });
        
        const binary = ClientMessage.encode(message).finish();
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
