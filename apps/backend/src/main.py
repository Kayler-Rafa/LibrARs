from contextlib import asynccontextmanager
from datetime import datetime, timezone
import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from . import database as db
from .auth.router import router as auth_router
from .gestures.router import router as gestures_router
from .admin.router import router as admin_router
from .socket_events import sio


async def run_migrations():
    """Migrações incrementais — seguras para rodar múltiplas vezes (IF NOT EXISTS)."""
    migrations = [
        # Índices de performance
        "CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)",
        "CREATE INDEX IF NOT EXISTS idx_gestures_created_at ON gestures(created_at DESC)",
        # Perfil do participante
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_student BOOLEAN NOT NULL DEFAULT false",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS has_disability BOOLEAN NOT NULL DEFAULT false",
        # Amostras brutas para pesquisa
        "ALTER TABLE gestures ADD COLUMN IF NOT EXISTS samples_raw JSONB NOT NULL DEFAULT '[]'::jsonb",
        # Tokens de convite
        """
        CREATE TABLE IF NOT EXISTS invite_tokens (
            id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            token       TEXT        UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
            created_by  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            used_by     UUID        REFERENCES users(id) ON DELETE SET NULL,
            used_at     TIMESTAMPTZ,
            expires_at  TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '7 days',
            created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """,
        # Tokens de reset de senha
        """
        CREATE TABLE IF NOT EXISTS reset_tokens (
            id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            token       TEXT        UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
            user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            used_at     TIMESTAMPTZ,
            expires_at  TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '24 hours',
            created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """,
    ]
    for sql in migrations:
        try:
            await db.execute(sql.strip())
        except Exception as e:
            print(f"⚠️  Migration skipped ({e})")
    print("✅  Migrations OK")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.create_pool()
    print("✅  DB pool created")
    await run_migrations()
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
app.include_router(admin_router, prefix="/api/admin", tags=["admin"])


@app.get("/health", tags=["health"])
async def health():
    return {"ok": True, "ts": datetime.now(timezone.utc).isoformat()}


# ── Socket.io ASGI wrapper ────────────────────────────────────────────────────
# uvicorn deve apontar para `src.main:socket_app`, NÃO para `app`,
# para que /socket.io/ seja tratado pelo python-socketio.
socket_app = socketio.ASGIApp(sio, other_asgi_app=app)
