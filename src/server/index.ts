import geckos, { type GeckosServer, type ServerChannel } from '@geckos.io/server';
import type { GameHooks, PlayerInput, WorldState, ClientInputPayload } from "../core/index.js";
import { 
    ServerMessage, 
    ClientMessage, 
    ServerMessage_Type, 
    ClientMessage_Type, 
    Player as ProtoPlayer 
} from "../schema/nexus.js"; 

export class NexusServer<State, Input> {
    private io: GeckosServer;
    private hooks: GameHooks<State, Input>;
    private state: WorldState<State> = {
        players: {},
        timestamp: 0
    };
    
    private lastTickTime: number;
    private inputBuffer: PlayerInput<Input>[];
    private buffered: number;

    constructor(hooks: GameHooks<State, Input>, port: number = 9208) {
        this.io = geckos(); 
        this.hooks = hooks;
        this.lastTickTime = Date.now();
        this.inputBuffer = new Array(200);
        this.buffered = 0;
        
        setInterval(() => this.tick(), 1000 / 60);
        setInterval(() => this.broadcastState(), 100);
        
        this.setupRoutes();

        this.io.listen(port);
        console.log(`[NexusServer] Geckos signaling server listening on port ${port}`);
    }

    private flushInputBuffer() {
        if (this.buffered > 0) {
            const batch = this.inputBuffer.slice(0, this.buffered).map(p => ({
                id: p.id,
                input: this.hooks.encodeInput(p.input),
                timestamp: p.timestamp
            }));
            
            const message = ServerMessage.create({
                type: ServerMessage_Type.UPDATE,
                update: { inputs: batch }
            });
            const binary = ServerMessage.encode(message).finish();
            
            setTimeout(() => {
                this.io.raw.emit(binary);
            }, 0);
            
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
        }
    }

    private serializeState(): Record<string, ProtoPlayer> {
        const serializedPlayers: Record<string, ProtoPlayer> = {};
        for (const pid in this.state.players) {
            const p = this.state.players[pid];
            if (!p) continue;
            serializedPlayers[pid] = ProtoPlayer.create({
                id: p.id,
                data: this.hooks.encodeState(p.data),
                lastProcessedTimestamp: p.lastProcessedTimestamp
            });
        }
        return serializedPlayers;
    }

    private setupRoutes() {
        this.io.onConnection((channel: ServerChannel) => {
            const { id } = channel;
            if (!id) return;
            
            console.log(`Player connected: ${id}`);
            
            const syncMessage = ServerMessage.create({
                type: ServerMessage_Type.SYNC,
                state: {
                    players: this.serializeState(),
                    timestamp: this.state.timestamp
                }
            });
            const binarySync = ServerMessage.encode(syncMessage).finish();
            
            setTimeout(() => {
                channel.raw.emit(binarySync);
            }, 0);
            
            this.state.players[id] = {
                id: id,
                data: this.hooks.getInitialPlayerState(id),
                lastProcessedTimestamp: 0
            };

            channel.onRaw((data: unknown) => {
                if (!(data instanceof ArrayBuffer) && !ArrayBuffer.isView(data)) return;
                
                try {
                    const buffer = new Uint8Array(data as ArrayBuffer);
                    const parsed = ClientMessage.decode(buffer);
                    
                    if (parsed.type === ClientMessage_Type.INPUT && parsed.input) {
                        const decodedInput = this.hooks.decodeInput(parsed.input.input);
                        
                        const playerInput: PlayerInput<Input> = { 
                            id: id, 
                            input: decodedInput,
                            timestamp: parsed.input.timestamp
                        };
                        
                        this.handleInput(id, playerInput);
                        this.inputBuffer[this.buffered++] = playerInput;
                        
                        if (this.buffered >= 200) {
                            this.flushInputBuffer();
                        }
                    }
                } catch (err) {
                    console.error("Failed to parse ClientMessage:", err);
                }
            });

            channel.onDisconnect((reason) => {
                console.log(`Player disconnected: ${id}. Reason: ${reason}`);
                delete this.state.players[id];
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
        
        const message = ServerMessage.create({
            type: ServerMessage_Type.SYNC,
            state: {
                players: this.serializeState(),
                timestamp: this.state.timestamp
            }
        });
        const binary = ServerMessage.encode(message).finish();
        
        setTimeout(() => {
            this.io.raw.emit(binary);
        }, 0);
    }
}
