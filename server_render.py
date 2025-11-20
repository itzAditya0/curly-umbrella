import asyncio
import json
import websockets
import secrets
import logging
from aiohttp import web

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Store connected clients: {user_id: websocket}
connected_clients = {}
# Store friendships: {user_id: set(friend_ids)}
friendships = {}

def generate_user_id():
    """Generate a unique 6-character alphanumeric ID."""
    while True:
        user_id = secrets.token_hex(3).upper()
        if user_id not in connected_clients:
            return user_id

async def register(websocket):
    """Register a new client connection."""
    user_id = generate_user_id()
    connected_clients[user_id] = websocket
    friendships[user_id] = set()
    logger.info(f"New user connected: {user_id}")
    return user_id

async def unregister(user_id):
    """Unregister a client connection."""
    if user_id in connected_clients:
        del connected_clients[user_id]
    if user_id in friendships:
        del friendships[user_id]
    logger.info(f"User disconnected: {user_id}")

async def handle_message(websocket, message, user_id):
    """Handle incoming messages from a client."""
    try:
        data = json.loads(message)
        msg_type = data.get('type')

        if msg_type == 'ADD_FRIEND':
            target_id = data.get('to')
            if target_id in connected_clients:
                target_ws = connected_clients[target_id]
                await target_ws.send(json.dumps({
                    'type': 'FRIEND_REQUEST',
                    'from': user_id
                }))
                logger.info(f"Friend request sent from {user_id} to {target_id}")

        elif msg_type == 'ACCEPT_FRIEND':
            requester_id = data.get('to')
            if requester_id in connected_clients:
                friendships[user_id].add(requester_id)
                friendships[requester_id].add(user_id)
                
                requester_ws = connected_clients[requester_id]
                await requester_ws.send(json.dumps({
                    'type': 'FRIEND_ACCEPTED',
                    'from': user_id
                }))
                logger.info(f"Friendship established between {user_id} and {requester_id}")

        elif msg_type == 'MESSAGE':
            recipient_id = data.get('to')
            if recipient_id in connected_clients:
                recipient_ws = connected_clients[recipient_id]
                await recipient_ws.send(json.dumps({
                    'type': 'MESSAGE',
                    'from': user_id,
                    'content': data.get('content'),
                    'timestamp': data.get('timestamp', asyncio.get_event_loop().time())
                }))

        elif msg_type == 'TYPING':
            recipient_id = data.get('to')
            if recipient_id in connected_clients:
                recipient_ws = connected_clients[recipient_id]
                await recipient_ws.send(json.dumps({
                    'type': 'TYPING',
                    'from': user_id
                }))

        elif msg_type in ['FILE_START', 'FILE_CHUNK', 'FILE_END']:
            recipient_id = data.get('to')
            if recipient_id in connected_clients:
                recipient_ws = connected_clients[recipient_id]
                data['from'] = user_id
                await recipient_ws.send(json.dumps(data))

    except json.JSONDecodeError:
        logger.error(f"Invalid JSON received from {user_id}")
    except Exception as e:
        logger.error(f"Error handling message from {user_id}: {str(e)}")

async def websocket_handler(websocket):
    """Handle WebSocket connections."""
    user_id = await register(websocket)
    try:
        await websocket.send(json.dumps({
            'type': 'WELCOME',
            'userId': user_id
        }))
        
        async for message in websocket:
            await handle_message(websocket, message, user_id)
            
    except websockets.ConnectionClosed:
        pass
    finally:
        await unregister(user_id)

async def http_health_check(request):
    """HTTP endpoint for Render health checks."""
    return web.Response(text="WebSocket Server Running\n")

async def start_servers():
    """Start both HTTP (for health checks) and WebSocket servers."""
    # HTTP server for health checks on port 8000
    app = web.Application()
    app.router.add_get('/health', http_health_check)
    app.router.add_head('/health', http_health_check)
    app.router.add_get('/', http_health_check)
    app.router.add_head('/', http_health_check)
    
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, '0.0.0.0', 8000)
    await site.start()
    logger.info("HTTP health check server started on port 8000")
    
    # WebSocket server on port 8765
    async with websockets.serve(websocket_handler, "0.0.0.0", 8765):
        logger.info("WebSocket server started on port 8765")
        await asyncio.Future()  # Run forever

if __name__ == "__main__":
    try:
        asyncio.run(start_servers())
    except KeyboardInterrupt:
        logger.info("Server stopped by user")
