import json
from fastapi import APIRouter, HTTPException, Depends
from .. import database as db
from ..auth.deps import get_current_user
from ..ml.classifier import weighted_knn
from ..ml.compressor import compress_samples
from ..ml.quality import filter_outliers
from .schemas import GestureCreate, ClassifyRequest, CompressRequest

router = APIRouter()


def _row_to_out(row: dict) -> dict:
    raw = row["samples"]
    samples: list = raw if isinstance(raw, list) else json.loads(raw)
    ca = row["created_at"]
    ua = row["updated_at"]
    return {
        "id": str(row["id"]),
        "name": row["name"],
        "samples": samples,
        "sample_count": row["sample_count"],
        "created_at": ca.isoformat() if hasattr(ca, "isoformat") else str(ca),
        "updated_at": ua.isoformat() if hasattr(ua, "isoformat") else str(ua),
    }


@router.get("")
async def list_gestures(current_user: dict = Depends(get_current_user)):
    rows = await db.fetch(
        "SELECT id, name, samples, sample_count, created_at, updated_at"
        " FROM gestures WHERE user_id = $1 ORDER BY created_at ASC",
        current_user["user_id"],
    )
    return [_row_to_out(r) for r in rows]


@router.get("/user/{user_id}")
async def list_user_gestures(user_id: str, current_user: dict = Depends(get_current_user)):
    # Apenas o próprio usuário pode ver seus gestos
    if str(current_user["user_id"]) != user_id:
        raise HTTPException(403, "Acesso negado")

    rows = await db.fetch(
        "SELECT id, name, samples, sample_count FROM gestures"
        " WHERE user_id = $1 ORDER BY created_at ASC",
        user_id,
    )
    return [
        {
            "id": str(r["id"]),
            "name": r["name"],
            "samples": r["samples"] if isinstance(r["samples"], list) else json.loads(r["samples"]),
            "sample_count": r["sample_count"],
        }
        for r in rows
    ]


@router.post("", status_code=201)
async def upsert_gesture(
    body: GestureCreate,
    current_user: dict = Depends(get_current_user),
):
    # Preserva todas as amostras brutas originais (dado de pesquisa)
    raw_samples = body.samples

    # Versão comprimida apenas para classificação local
    clean, _ = filter_outliers(body.samples)
    compressed = compress_samples(clean, n_clusters=20)

    gesture_name = body.name.strip().upper()

    # ON CONFLICT por (user_id, name) garante que o mesmo gesto gravado em
    # dispositivos diferentes não gera duplicatas nem viola a constraint.
    row = await db.fetchrow(
        """
        INSERT INTO gestures (id, user_id, name, samples, samples_raw, sample_count)
        VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4::jsonb, $5::jsonb, $6)
        ON CONFLICT (user_id, name) DO UPDATE
          SET samples      = EXCLUDED.samples,
              samples_raw  = EXCLUDED.samples_raw,
              sample_count = EXCLUDED.sample_count,
              updated_at   = now()
        RETURNING id, name, samples, sample_count, created_at, updated_at
        """,
        body.id if body.id else None,
        current_user["user_id"],
        gesture_name,
        json.dumps(compressed),
        json.dumps(raw_samples),
        len(compressed),
    )
    return _row_to_out(row)


@router.delete("/{gesture_id}")
async def delete_gesture(gesture_id: str, current_user: dict = Depends(get_current_user)):
    rows = await db.fetch(
        "DELETE FROM gestures WHERE id = $1 AND user_id = $2 RETURNING id",
        gesture_id,
        current_user["user_id"],
    )
    if not rows:
        raise HTTPException(404, "Gesto não encontrado")
    return {"ok": True}


@router.post("/classify")
async def classify_gesture(
    body: ClassifyRequest,
    current_user: dict = Depends(get_current_user),
):
    result = weighted_knn(body.vector, body.gestures)
    if result is None:
        return {"name": None, "confidence": 0.0}
    return result


@router.post("/compress")
async def compress_gesture_samples(
    body: CompressRequest,
    current_user: dict = Depends(get_current_user),
):
    compressed = compress_samples(body.samples)
    return {
        "samples": compressed,
        "original_count": len(body.samples),
        "compressed_count": len(compressed),
    }
