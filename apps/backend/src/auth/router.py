from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from .. import database as db
from .service import hash_password, verify_password, make_token
from .deps import get_current_user

router = APIRouter()


class RegisterBody(BaseModel):
    email: str
    password: str
    name: str | None = None


class LoginBody(BaseModel):
    email: str
    password: str


@router.post("/register", status_code=201)
async def register(body: RegisterBody):
    email = body.email.lower().strip()

    existing = await db.fetchrow("SELECT id FROM users WHERE email = $1", email)
    if existing:
        raise HTTPException(409, "Este email já está cadastrado")

    pw_hash = hash_password(body.password)
    display_name = (body.name or "").strip() or email.split("@")[0]

    user = await db.fetchrow(
        "INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3)"
        " RETURNING id, email, name",
        email,
        pw_hash,
        display_name,
    )
    return {
        "token": make_token(str(user["id"]), user["email"]),
        "user": {"id": str(user["id"]), "email": user["email"], "name": user["name"]},
    }


@router.post("/login")
async def login(body: LoginBody):
    email = body.email.lower().strip()

    user = await db.fetchrow(
        "SELECT id, email, name, password_hash FROM users WHERE email = $1", email
    )
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Email ou senha incorretos")

    return {
        "token": make_token(str(user["id"]), user["email"]),
        "user": {"id": str(user["id"]), "email": user["email"], "name": user["name"]},
    }


@router.get("/me")
async def me(current_user: dict = Depends(get_current_user)):
    user = await db.fetchrow(
        "SELECT id, email, name FROM users WHERE id = $1", current_user["user_id"]
    )
    if not user:
        raise HTTPException(404, "Usuário não encontrado")
    return {"id": str(user["id"]), "email": user["email"], "name": user["name"]}
