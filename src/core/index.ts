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
    applyInput: (state: State, input: PlayerInput<Input>) => State;
    syncState: (state: State) => State;
}
