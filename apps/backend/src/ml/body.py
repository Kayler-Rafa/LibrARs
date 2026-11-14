"""
Item 2 — referência corporal.

Cada quadro de uma gravação pode trazer 10 features de corpo (posição da mão em
relação a ombros e rosto, em larguras de ombro). Elas ficam em vetores SEPARADOS
dos vetores de forma da mão (63 e 252 valores), que não mudam de formato:

  sampled       (≤20 × 63)   ↔  sampled_body   (≤20 × 10, ou null por amostra)
  temporal      (252)        ↔  temporal_body  (40, ou null)

Assim as gravações antigas (sem pose) continuam válidas: onde o corpo é null,
o classificador usa só a forma (w = 0).
"""
import numpy as np
from sklearn.cluster import MiniBatchKMeans

BODY_DIM = 10            # features de corpo por quadro
BODY_TEMPORAL_DIM = 40   # 10 × 4 blocos: média, desvio-padrão, velocidade média, deslocamento
MIN_VALID_RATIO = 0.5    # fração mínima de quadros com pose para gerar o vetor temporal de corpo


def frame_features(body: list[dict] | None, n_frames: int) -> list[list[float] | None]:
    """Extrai, por quadro, as 10 features de corpo — ou None quando a pose não é válida."""
    if not body:
        return [None] * n_frames
    feats: list[list[float] | None] = []
    for b in body:
        f = b.get("features") if b.get("pose_ok") else None
        feats.append(list(f) if f is not None and len(f) == BODY_DIM else None)
    return feats


def pose_ratio(feats: list[list[float] | None]) -> float:
    """Fração dos quadros da gravação com pose válida."""
    if not feats:
        return 0.0
    return sum(1 for f in feats if f is not None) / len(feats)


def _mean_body(feats: list[list[float] | None], idx) -> list[float] | None:
    valid = [feats[i] for i in idx if feats[i] is not None]
    if not valid:
        return None
    return np.mean(np.array(valid, dtype=np.float32), axis=0).tolist()


def sample_with_body(
    frames: list[list[float]],
    feats: list[list[float] | None],
    n_clusters: int = 20,
    sigma: float = 3.0,
) -> tuple[list[list[float]], list[list[float] | None]]:
    """
    Mesma amostragem de antes (remoção de outliers a 3σ + MiniBatchKMeans sobre a
    FORMA da mão), mas preservando a correspondência com o corpo:
      - se nada é comprimido, cada amostra leva as features do seu próprio quadro;
      - se há compressão, cada centróide leva a média das features dos quadros
        (com pose válida) que caíram no seu grupo.
    O agrupamento olha só para a forma, então `sampled` sai idêntico ao do Item 1.
    """
    n = len(frames)
    kept = list(range(n))
    clean = frames

    if n >= 5:
        X = np.array(frames, dtype=np.float32)
        dists = np.linalg.norm(X - X.mean(axis=0), axis=1)
        mask = dists <= dists.mean() + sigma * dists.std()
        kept = [i for i in range(n) if mask[i]]
        clean = X[mask].tolist()

    if len(clean) <= n_clusters:
        return clean, [feats[i] for i in kept]

    Xc = np.array(clean, dtype=np.float32)
    kmeans = MiniBatchKMeans(n_clusters=n_clusters, random_state=42, n_init=3)
    kmeans.fit(Xc)
    labels = kmeans.labels_

    sampled_body: list[list[float] | None] = []
    for c in range(n_clusters):
        members = [kept[j] for j in range(len(kept)) if labels[j] == c]
        sampled_body.append(_mean_body(feats, members))
    return kmeans.cluster_centers_.tolist(), sampled_body


def body_temporal(feats: list[list[float] | None]) -> list[float] | None:
    """
    Vetor temporal do corpo (40 valores): os mesmos 4 blocos do vetor temporal da
    forma, aplicados às 10 features, usando apenas os quadros com pose válida.
    Retorna None se menos de metade dos quadros tiver pose (a gravação fica só com forma).
    """
    valid = [f for f in feats if f is not None]
    if not feats or not valid or len(valid) / len(feats) < MIN_VALID_RATIO:
        return None

    X = np.array(valid, dtype=np.float32)   # (N, 10)
    mean = X.mean(axis=0)
    std = X.std(axis=0)
    if len(valid) >= 2:
        velocity = np.diff(X, axis=0).mean(axis=0)
        displacement = X[-1] - X[0]
    else:
        velocity = np.zeros(BODY_DIM, dtype=np.float32)
        displacement = np.zeros(BODY_DIM, dtype=np.float32)
    return np.concatenate([mean, std, velocity, displacement]).tolist()
