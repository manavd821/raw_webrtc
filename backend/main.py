import uuid

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, WebSocketException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path

sockets = {}
user_ids = []
origins = [
    "http://localhost:3000",   # Typical React/Next.js dev port
    "http://localhost:5173",   # Typical Vite dev port
    # "https://your-production-domain.com",
    "https://raw-webrtc-three.vercel.app"
]

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def send_data(data : dict):
    u_id = data["to"]
    if not u_id:
        print(u_id)
        raise RuntimeError("uid not found")
    ws : WebSocket = sockets.get(u_id) # type: ignore
    if ws is None:
        raise RuntimeError("target websocket not found")
    await ws.send_json(data)

async def create_the_offer():
    data = {
        "type" : "create_offer",
        "data" : "",
        "from" : user_ids[1],
        "to" : user_ids[0],
    }
    await send_data(data)

async def store_video(video_bytes, client_id):
    directory_path = Path("videos");
    directory_path.mkdir(exist_ok=True)
    
    file_path = directory_path / f"video_{client_id}.webm"
    
    with file_path.open("ab") as buffer:
        buffer.write(video_bytes)
            
    return {
        "type" : "recording",
        "message": "Video uploaded successfully",
        "path": str(file_path),
    }
    
@app.get('/')
async def home():
    return {"name" : "manav"}


@app.websocket('/ws/{client_id}')
async def handle_signaling(ws : WebSocket, client_id : str):
    try:
        await ws.accept()
    except WebSocketException as e:
        print(e.code)
    
    sockets[client_id] = ws
    user_ids.append(client_id)
    
    print(f"{sockets=}")
    print(f"{user_ids=}")
    
    if len(user_ids) == 2:
        await create_the_offer()
    try:
        while True:
            data = await ws.receive_json()
            print(f"{data=}")
            await send_data(data)
            
        
    except WebSocketDisconnect:
        print(f"{client_id} disconnected")
        user_ids.remove(client_id)
        sockets.pop(client_id)

@app.websocket("/ws/upload_video/{client_id}")
async def get_video(ws: WebSocket, client_id : str):
    try:
        await ws.accept()
    except WebSocketException as e:
        print(e.code)
        
    try:
        while True:
            video_bytes = await ws.receive_bytes()
            success_msg = await store_video(video_bytes, client_id)
            await ws.send_json(success_msg)
            
    except WebSocketDisconnect:
        try:
            print(f"{client_id} disconnected")
            user_ids.remove(client_id)
            sockets.pop(client_id)
        except ValueError as e:
            print("")
    except Exception as e:
        print(e)
    