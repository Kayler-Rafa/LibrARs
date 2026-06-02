import random
import socketio
from .config import settings

_cors = [o.strip() for o in settings.CORS_ORIGIN.split(",")]

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=_cors,
)

# rooms: code → list of {"sid", "user_id", "user_name"}
_rooms: dict[str, list[dict]] = {}
_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def _gen_code() -> str:
    while True:
        code = "".join(random.choices(_CHARS, k=6))
        if code not in _rooms:
            return code


@sio.event
async def connect(sid, environ):
    print(f"[ws] connected  {sid}")


@sio.on("create-room")
async def create_room(sid, data):
    code = _gen_code()
    _rooms[code] = [{"sid": sid, "user_id": data.get("userId"), "user_name": data.get("userName")}]
    await sio.enter_room(sid, code)
    print(f"[ws] room created  {code}")
    return {"code": code}


@sio.on("join-room")
async def join_room(sid, data):
    code = (data.get("code") or "").upper().strip()
    room = _rooms.get(code)

    if not room:
        return {"error": "Sala não encontrada"}
    if len(room) >= 2:
        return {"error": "Sala cheia (máximo 2 pessoas)"}

    peer = room[0]
    room.append({"sid": sid, "user_id": data.get("userId"), "user_name": data.get("userName")})
    await sio.enter_room(sid, code)

    await sio.emit(
        "peer-joined",
        {"userId": data.get("userId"), "userName": data.get("userName")},
        to=peer["sid"],
    )
    print(f"[ws] user joined room  {code}")
    return {"ok": True, "peerUserId": peer["user_id"], "peerUserName": peer["user_name"]}


@sio.on("webrtc-offer")
async def webrtc_offer(sid, data):
    await sio.emit("webrtc-offer", {"sdp": data.get("sdp")}, room=data.get("code"), skip_sid=sid)


@sio.on("webrtc-answer")
async def webrtc_answer(sid, data):
    await sio.emit("webrtc-answer", {"sdp": data.get("sdp")}, room=data.get("code"), skip_sid=sid)


@sio.on("webrtc-ice")
async def webrtc_ice(sid, data):
    await sio.emit("webrtc-ice", {"candidate": data.get("candidate")}, room=data.get("code"), skip_sid=sid)


@sio.on("gesture")
async def gesture(sid, data):
    await sio.emit(
        "peer-gesture",
        {"gesture": data.get("gesture"), "confidence": data.get("confidence")},
        room=data.get("code"),
        skip_sid=sid,
    )


@sio.on("speech")
async def speech(sid, data):
    """Fala transcrita pelo STT — envia para o outro participante da sala."""
    await sio.emit(
        "peer-speech",
        {"text": data.get("text"), "final": data.get("final", False)},
        room=data.get("code"),
        skip_sid=sid,
    )


@sio.event
async def disconnect(sid):
    print(f"[ws] disconnected  {sid}")
    for code, members in list(_rooms.items()):
        idx = next((i for i, m in enumerate(members) if m["sid"] == sid), None)
        if idx is None:
            continue
        members.pop(idx)
        await sio.emit("peer-left", {}, room=code)
        if not members:
            del _rooms[code]
            print(f"[ws] room deleted  {code}")
        break
