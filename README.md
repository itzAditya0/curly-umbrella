# Secure Chat Platform

A secure, zero-knowledge, real-time messaging platform using Python WebSockets and client-side OpenPGP encryption.

## Features
- **End-to-End Encryption**: All messages are encrypted in the browser using OpenPGP.js.
- **Zero-Knowledge Server**: The server only routes encrypted JSON blobs; it cannot read messages.
- **Ephemeral Identity**: No persistent accounts. Users are identified by temporary session IDs.
- **Terminal Aesthetic**: Cyberpunk-inspired UI.

## Project Structure
- `server.py`: Python WebSocket server.
- `index.html`: Main frontend entry point.
- `style.css`: Styling.
- `script.js`: Frontend logic (PGP + WebSockets).
- `requirements.txt`: Python dependencies.

## Local Setup

### Prerequisites
- Python 3.8+
- Modern Web Browser

### 1. Start the Server
```bash
pip install -r requirements.txt
python server.py
```
The server will start on `ws://localhost:8765`.

### 2. Start the Client
Simply open `index.html` in your browser.
OR serve it with a simple HTTP server:
```bash
python -m http.server 8000
```
Then visit `http://localhost:8000`.

## Usage
1.  **Generate Keys**: If you don't have PGP keys, generate them using GPG or software like Kleopatra.
2.  **Login**: Upload your Public and Private key files and enter your passphrase.
3.  **Connect**: Click "ESTABLISH_UPLINK".
4.  **Add Friend**: Share your 6-character ID with a friend. Enter their ID in the "TARGET_ID" box and click ADD.
5.  **Chat**: Once they accept, click their ID in the list and start chatting.

## Deployment

### Frontend (Vercel)
You can deploy the `index.html`, `style.css`, and `script.js` to Vercel.
**Note**: You must update the WebSocket URL in `script.js` to point to your production server (e.g., `wss://your-vps-ip:8765`).

### Backend (VPS/Render/Railway)
The `server.py` needs a persistent environment.
- **VPS**: Copy files, install requirements, run `python server.py`. Use Nginx as a reverse proxy for SSL (`wss://`).
- **Render/Railway**: Deploy as a Python service. Ensure port 8765 is exposed (or use the environment's port).

## Security Note
This is a proof-of-concept. For production:
- Use **WSS (WebSocket Secure)**.
- Audit the code.
- Serve over HTTPS.
