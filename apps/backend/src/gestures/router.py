import json
from fastapi import APIRouter, HTTPException, Depends
from .. import database as db
from ..auth.deps import get_current_user
from ..ml.classifier import weighted_knn
from ..ml.compressor import compress_samples
from ..ml.quality import filter_outliers
from ..ml.temporal import extract_temporal_features
from .schemas import GestureCreate, ClassifyRequest, CompressRequest

router = APIRouter()


def _parse_jsonb(value) -> list:
    if isinstance(value, list):
        return value
    if value:
        return json.loads(value)
    return []


def _row_to_out(row: dict) -> dict:
    ca = row["created_at"]
    ua = row["updated_at"]
    return {
        "id": str(row["id"]),
        "name": row["name"],
        "samples": _parse_jsonb(row["samples"]),
        "temporal_features": _parse_jsonb(row.get("samples_temporal") or []),
        "sample_count": row["sample_count"],
        "created_at": ca.isoformat() if hasattr(ca, "isoformat") else str(ca),
        "updated_at": ua.isoformat() if hasattr(ua, "isoformat") else str(ua),
    }


@router.get("")
async def list_gestures(current_user: dict = Depends(get_current_user)):
    rows = await db.fetch(
        "SELECT id, name, samples, samples_temporal, sample_count, created_at, updated_at"
        " FROM gestures WHERE user_id = $1 ORDER BY created_at ASC",
        current_user["user_id"],
    )
    return [_row_to_out(r) for r in rows]


@router.get("/dataset")
async def collective_dataset(_: dict = Depends(get_current_user)):
    """
    Base coletiva: amostras de TODOS os participantes agregadas por nome de gesto.
    Retorna amostras comprimidas (compatibilidade) + vetor temporal de cada gravação
    (para o classificador temporal no navegador).
    """
    CAP_PER_NAME = 120

    rows = await db.fetch(
        "SELECT name, samples, samples_temporal FROM gestures ORDER BY updated_at DESC"
    )

    agg: dict[str, dict] = {}
    for r in rows:
        name = r["name"]
        samples = _parse_jsonb(r["samples"])
        temporal = _parse_jsonb(r.get("samples_temporal") or [])

        bucket = agg.setdefault(name, {"samples": [], "temporal_vectors": []})
        if len(bucket["samples"]) < CAP_PER_NAME:
            bucket["samples"].extend(samples[:CAP_PER_NAME - len(bucket["samples"])])
        if temporal:
            bucket["temporal_vectors"].append(temporal)

    return [
        {
            "name": name,
            "samples": data["samples"][:CAP_PER_NAME],
            "temporal_vectors": data["temporal_vectors"],
        }
        for name, data in agg.items()
    ]


@router.get("/user/{user_id}")
async def list_user_gestures(user_id: str, current_user: dict = Depends(get_current_user)):
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
            "samples": _parse_jsonb(r["samples"]),
            "sample_count": r["sample_count"],
        }
        for r in rows
    ]


@router.post("", status_code=201)
async def upsert_gesture(
    body: GestureCreate,
    current_user: dict = Depends(get_current_user),
):
    raw_samples = body.samples

    clean, _ = filter_outliers(body.samples)
    compressed = compress_samples(clean, n_clusters=20)

    # Extrai vetor temporal 315-dim a partir da sequência bruta de frames
    temporal_features = extract_temporal_features(raw_samples)

    gesture_name = body.name.strip().upper()

    row = await db.fetchrow(
        """
        INSERT INTO gestures (id, user_id, name, samples, samples_raw, samples_temporal, sample_count)
        VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7)
        ON CONFLICT (user_id, name) DO UPDATE
          SET samples          = EXCLUDED.samples,
              samples_raw      = EXCLUDED.samples_raw,
              samples_temporal = EXCLUDED.samples_temporal,
              sample_count     = EXCLUDED.sample_count,
              updated_at       = now()
        RETURNING id, name, samples, samples_temporal, sample_count, created_at, updated_at
        """,
        body.id if body.id else None,
        current_user["user_id"],
        gesture_name,
        compressed,
        raw_samples,
        temporal_features,
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
