export interface Player<State> {
    id: string;
    data: State;
    lastProcessedTimestamp: number;
}

export interface WorldState<State> {
    players: Record<string, Player<State>>;
    timestamp: number;
}

export interface PlayerInput<Input> {
    id: string;
    input: Input;
    timestamp: number;
}

export interface ClientInputPayload<Input> {
    input: Input;
    timestamp: number;
}

export interface GameHooks<State, Input> {
    getInitialPlayerState: (playerId: string) => State;
    applyInput: (state: State, input: PlayerInput<Input>) => void;
    updateState: (state: State, deltaTime: number) => State;
    
    encodeState: (state: State) => Uint8Array;
    decodeState: (buffer: Uint8Array) => State;
    encodeInput: (input: Input) => Uint8Array;
    decodeInput: (buffer: Uint8Array) => Input;
}
