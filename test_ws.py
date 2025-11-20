import asyncio
import aiohttp
import sys

async def test_connection():
    url = 'ws://127.0.0.1:8765/ws'
    print(f"Attempting to connect to {url}...")
    try:
        async with aiohttp.ClientSession() as session:
            async with session.ws_connect(url) as ws:
                print("Connected successfully!")
                async for msg in ws:
                    if msg.type == aiohttp.WSMsgType.TEXT:
                        print(f"Received: {msg.data}")
                        break
                    elif msg.type == aiohttp.WSMsgType.ERROR:
                        print('Error during receive')
                        break
    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == "__main__":
    try:
        asyncio.run(test_connection())
    except KeyboardInterrupt:
        pass
