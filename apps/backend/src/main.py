from contextlib import asynccontextmanager
from datetime import datetime, timezone
import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from . import database as db
from .auth.router import router as auth_router
from .gestures.router import router as gestures_router
from .socket_events import sio


@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.create_pool()
    print("✅  DB pool created")
    yield
    await db.close_pool()
    print("👋  DB pool closed")


app = FastAPI(title="LibrARs API", version="2.0.0", lifespan=lifespan, redirect_slashes=False)

_cors_origins = [o.strip() for o in settings.CORS_ORIGIN.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(gestures_router, prefix="/api/gestures", tags=["gestures"])


@app.get("/health", tags=["health"])
async def health():
    return {"ok": True, "ts": datetime.now(timezone.utc).isoformat()}


# ── Socket.io ASGI wrapper ────────────────────────────────────────────────────
# uvicorn deve apontar para `src.main:socket_app`, NÃO para `app`,
# para que /socket.io/ seja tratado pelo python-socketio.
socket_app = socketio.ASGIApp(sio, other_asgi_app=app)
