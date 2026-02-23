# Nexus: A High-Performance Multiplayer Game Server

Nexus is a lightweight, high-performance multiplayer game server framework designed for real-time synchronization using **WebRTC** (via Geckos.io) and **Protocol Buffers**. It provides a generic, type-safe architecture that handles the complexities of networking, binary serialization, and client-side prediction, allowing you to focus on game logic.


---

## Overview

Nexus separates the networking engine from the game logic. The engine handles the "envelope" (World State, Player Inputs, and Connection batches), while you provide the logic for how those bytes are interpreted.

### Core Components

1. **NexusServer**: Manages the Geckos.io server, handles player connections, and broadcasts states.
2. **NexusClient**: Manages the WebRTC connection, handles local input prediction, and reconciles state with the server.
3. **GameHooks**: The interface you implement to define how your game state changes based on inputs and time (delta time).

---

## Getting Started

### 1. Define Your Protobuf Schema

Define your game-specific data in a `.proto` file to ensure high-performance binary serialization.

```protobuf
syntax = "proto3";
package game;

message Intent {
  bool UP = 1;
  bool DOWN = 2;
}

message GameState {
  float x = 1;
  float y = 2;
}

```

### 2. Implement Game Hooks

Implement the `GameHooks` interface to link your Protobuf logic to the Nexus engine.

```typescript
// for example
import { GameState, Intent } from "./proto/game.js";

const hooks: GameHooks<MyState, MyInput> = {
    getInitialPlayerState: (id) => ({ x: 100, y: 100 }),
    
    applyInput: (state, playerInput) => {
        // example input
        if (playerInput.input.UP) state.y -= 10;
    },
    
    updateState: (state, deltaTime) => {
        // update logic here
        return state;
    },

    encodeState: (state) => GameState.encode(state).finish(),
    decodeState: (buffer) => GameState.decode(buffer),
    encodeInput: (input) => Intent.encode(input).finish(),
    decodeInput: (buffer) => Intent.decode(buffer)
};

```

### 3. Initialize the Server

```typescript
import { NexusServer } from "nexus/server";

const server = new NexusServer(hooks, 9208);

```

### 4. Initialize the Client

```typescript
import { NexusClient } from "nexus/client";

const client = new NexusClient("http://127.0.0.1", hooks, 9208);

// example input
client.sendInput({ UP: true, DOWN: false });
```

---

## Performance Testing

Nexus includes a stress test suite capable of simulating hundreds of concurrent WebRTC connections to measure server stability and latency.

To run the included 2D test environment:

1. Start the server: `npm run test`
2. Open `http://127.0.0.1:8080` in your browser.
3. To stress test server use `npm run stress`.
