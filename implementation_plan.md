# Secure Chat Platform Implementation Plan

## Goal Description
Build a secure, zero-knowledge, real-time messaging platform using Python WebSockets and client-side OpenPGP encryption. The server acts only as a router, and the client handles all cryptography.

## User Review Required
> [!IMPORTANT]
> - **OpenPGP.js**: I will use the OpenPGP.js library via CDN (cdnjs) for the client.
> - **Ephemeral Storage**: The server will store active connections in memory only. If the server restarts, all connections and friend pairings are lost (as per "No Persistent User Accounts").
> - **SSL/TLS**: For local development, we will use `ws://`. Production would require `wss://` and a reverse proxy (Nginx) as noted in the prompt, but I will implement the core application first.

## Proposed Changes

### Backend (Python)
#### [NEW] [server.py](file:///Users/itzaditya/Codez/SecChat/server.py)
- WebSocket server implementation using `websockets` and `asyncio`.
- **Features**:
    - Connection handling & ID generation (6-char random).
    - Message routing (JSON payloads).
    - Event types: `CONNECT`, `FRIEND_REQUEST`, `FRIEND_ACCEPT`, `MESSAGE`, `DISCONNECT`.
    - In-memory store: `connected_clients = {id: websocket}`, `friendships = {id: [friend_ids]}`.

#### [NEW] [requirements.txt](file:///Users/itzaditya/Codez/SecChat/requirements.txt)
- `websockets`

### Frontend (HTML/CSS/JS)
#### [NEW] [index.html](file:///Users/itzaditya/Codez/SecChat/index.html)
- Single Page Application structure.
- Sections:
    - **Landing/Setup**: Key upload (Public/Private) + Passphrase.
    - **Dashboard**: User ID display, Add Friend input, Friends List, Chat Window.
- Import OpenPGP.js from CDN.

#### [NEW] [style.css](file:///Users/itzaditya/Codez/SecChat/style.css)
- **Theme**: Terminal/Cyberpunk aesthetic.
- Dark background, monospaced fonts (Google Fonts: 'JetBrains Mono' or similar), neon accents (green/cyan).
- Responsive layout (Flexbox/Grid).

#### [NEW] [script.js](file:///Users/itzaditya/Codez/SecChat/script.js)
- **State Management**: Store current user keys (decrypted private key object), session ID, friends list.
- **WebSocket**: Handle connection, automatic reconnection, message dispatching.
- **PGP Logic**:
    - `openpgp.readKey`, `openpgp.decryptKey`.
    - `openpgp.encrypt`, `openpgp.decrypt`.
    - Verify public keys.

## Verification Plan

### Automated Tests
- I will create a simple python test script `test_server.py` to connect two clients to the websocket server and verify message routing.

### Manual Verification
1.  Start `server.py`.
2.  Open `index.html` in two separate browser windows (or Incognito).
3.  **User A**: Upload keys, get ID.
4.  **User B**: Upload keys, get ID.
5.  **Friend Request**: User A adds User B. User B accepts.
6.  **Chat**: Exchange messages. Verify text is encrypted in network tab (if possible to inspect) or just verify end-to-end delivery.
