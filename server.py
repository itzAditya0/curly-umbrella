import asyncio
import json
import websockets
import secrets
import logging

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
        # Using secrets for secure random generation
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
        # Notify friends about disconnection? 
        # For privacy/simplicity, we might just let messages fail.
        # But removing from memory is important.
        del friendships[user_id]
    logger.info(f"User disconnected: {user_id}")

async def handle_message(websocket, message, user_id):
    """Handle incoming messages from a client."""
    try:
        data = json.loads(message)
        msg_type = data.get('type')

        if msg_type == 'FRIEND_REQUEST':
            target_id = data.get('targetId')
            public_key = data.get('publicKey')
            
            if target_id == user_id:
                await websocket.send(json.dumps({
                    'type': 'ERROR',
                    'message': 'You cannot add yourself.'
                }))
                return

            if target_id in connected_clients:
                target_ws = connected_clients[target_id]
                await target_ws.send(json.dumps({
                    'type': 'FRIEND_REQUEST',
                    'from': user_id,
                    'publicKey': public_key
                }))
                logger.info(f"Friend request sent from {user_id} to {target_id}")
            else:
                await websocket.send(json.dumps({
                    'type': 'ERROR',
                    'message': 'User not found or offline.'
                }))

        elif msg_type == 'FRIEND_ACCEPT':
            requester_id = data.get('requesterId')
            public_key = data.get('publicKey') # The acceptor's public key
            
            if requester_id in connected_clients:
                # Establish friendship both ways
                friendships[user_id].add(requester_id)
                friendships[requester_id].add(user_id)
                
                requester_ws = connected_clients[requester_id]
                await requester_ws.send(json.dumps({
                    'type': 'FRIEND_ACCEPT',
                    'from': user_id,
                    'publicKey': public_key
                }))
                logger.info(f"Friendship established between {user_id} and {requester_id}")
            else:
                await websocket.send(json.dumps({
                    'type': 'ERROR',
                    'message': 'Requester is no longer online.'
                }))

        elif msg_type == 'MESSAGE':
            recipient_id = data.get('to')
            encrypted_content = data.get('content')
            
            if recipient_id in friendships.get(user_id, set()):
                if recipient_id in connected_clients:
                    recipient_ws = connected_clients[recipient_id]
                    await recipient_ws.send(json.dumps({
                        'type': 'MESSAGE',
                        'from': user_id,
                        'content': encrypted_content,
                        'timestamp': data.get('timestamp')
                    }))
                    logger.info(f"Message routed from {user_id} to {recipient_id}")
                else:
                    await websocket.send(json.dumps({
                        'type': 'ERROR',
                        'message': 'User is offline.'
                    }))
            else:
                await websocket.send(json.dumps({
                    'type': 'ERROR',
                    'message': 'You are not friends with this user.'
                }))

    except json.JSONDecodeError:
        logger.error(f"Invalid JSON received from {user_id}")
    except Exception as e:
        logger.error(f"Error handling message from {user_id}: {str(e)}")

async def handler(websocket): # Removed path argument for compatibility with newer websockets
    """Main WebSocket handler."""
    user_id = await register(websocket)
    try:
        # Send the assigned User ID to the client
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

async def main():
    # Listen on all interfaces
    async with websockets.serve(handler, "0.0.0.0", 8765):
        logger.info("Secure Chat Server started on port 8765")
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Server stopped by user")
