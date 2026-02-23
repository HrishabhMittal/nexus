import geckos, { type GeckosServer, type ServerChannel } from '@geckos.io/server';
import type { GameHooks, PlayerInput, WorldState, ClientInputPayload } from "../core/index.js";

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
            const batch = this.inputBuffer.slice(0, this.buffered);
            
            const rawMessage = JSON.stringify({ e: "U", d: batch });
            const binary = new TextEncoder().encode(rawMessage);
            
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

    private setupRoutes() {
        this.io.onConnection((channel: ServerChannel) => {
            const { id } = channel;
            
            if (!id) return;
            
            console.log(`Player connected: ${id}`);
            
            const initialSync = JSON.stringify({ e: "S", d: this.state });
            const binarySync = new TextEncoder().encode(initialSync);
            setTimeout(() => {
                channel.raw.emit(binarySync);
            }, 0);
            
            this.state.players[id] = {
                id: id,
                data: this.hooks.getInitialPlayerState(id),
                lastProcessedTimestamp: 0
            };

            channel.onRaw((data: unknown) => {
                if (!data || typeof data === 'string') return;
                
                const messageString = new TextDecoder().decode(data as any);
                
                const parsed = JSON.parse(messageString);
                
                if (parsed.e === "I") {
                    const payload = parsed.d as ClientInputPayload<Input>;
                    
                    const playerInput: PlayerInput<Input> = { 
                        id: id, 
                        input: payload.input,
                        timestamp: payload.timestamp
                    };
                    
                    this.handleInput(id, playerInput);
                    this.inputBuffer[this.buffered++] = playerInput;
                    
                    if (this.buffered >= 200) {
                        this.flushInputBuffer();
                    }
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
        
        const rawMessage = JSON.stringify({ e: "S", d: this.state });
        const binary = new TextEncoder().encode(rawMessage);
        
        setTimeout(() => {
            this.io.raw.emit(binary);
        }, 0);
    }
}
