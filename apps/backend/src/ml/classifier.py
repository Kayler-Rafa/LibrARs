from typing import Optional
import numpy as np


def weighted_knn(
    vector: list[float],
    gestures: list[dict],
    k: int = 5,
    threshold: float = 0.45,
) -> Optional[dict]:
    """
    Weighted KNN classification using NumPy.

    Vizinhos mais próximos recebem peso 1/(dist² + ε), resultando em
    confiança contínua 0–1 (ao contrário do voto simples do KNN clássico
    que só produz 0.33 / 0.66 / 1.0 com k=3).

    gestures: lista de dicts com 'name' e 'samples' (vetores 63-dim)
    """
    if not gestures:
        return None

    all_vectors: list[list[float]] = []
    all_names: list[str] = []
    for g in gestures:
        for s in g.get("samples", []):
            all_vectors.append(s)
            all_names.append(g["name"])

    if not all_vectors:
        return None

    X = np.array(all_vectors, dtype=np.float32)   # (N, 63)
    q = np.array(vector, dtype=np.float32)         # (63,)

    dists = np.linalg.norm(X - q, axis=1)          # (N,)

    k_eff = min(k, len(dists))
    idx = np.argpartition(dists, k_eff - 1)[:k_eff]

    weights: dict[str, float] = {}
    for i in idx:
        name = all_names[int(i)]
        d = float(dists[int(i)])
        w = 1.0 / (d**2 + 1e-6)
        weights[name] = weights.get(name, 0.0) + w

    total = sum(weights.values())
    winner = max(weights, key=lambda n: weights[n])
    confidence = weights[winner] / total

    if confidence < threshold:
        return None

    return {"name": winner, "confidence": round(float(confidence), 4)}
