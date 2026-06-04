import numpy as np

POSE_DIM = 63       # 21 landmarks × 3 (x, y, z)
TEMPORAL_DIM = 252  # 63 × 4 features: mean_pose, std_pose, mean_velocity, displacement


def extract_temporal_features(frames: list[list[float]]) -> list[float]:
    """
    Extrai vetor temporal de 252 dims a partir de uma sequência de N frames (cada 63-dim):
      - mean_pose (63):     forma média da mão durante o gesto
      - std_pose (63):      variância por dimensão (≈0 em sinais estáticos)
      - mean_velocity (63): direção e magnitude média do movimento frame a frame
      - displacement (63):  deslocamento líquido (último frame − primeiro frame)

    Funciona para sinais estáticos (velocidade≈0) e dinâmicos (velocidade>0),
    permitindo que um único KNN classifique ambos os tipos.
    """
    if not frames:
        return [0.0] * TEMPORAL_DIM

    X = np.array(frames, dtype=np.float32)  # (N, 63)

    mean_pose = X.mean(axis=0)   # (63,)
    std_pose = X.std(axis=0)     # (63,)

    if len(frames) >= 2:
        deltas = np.diff(X, axis=0)          # (N-1, 63)
        mean_velocity = deltas.mean(axis=0)  # (63,)
        displacement = X[-1] - X[0]          # (63,)
    else:
        mean_velocity = np.zeros(POSE_DIM, dtype=np.float32)
        displacement = np.zeros(POSE_DIM, dtype=np.float32)

    return np.concatenate([mean_pose, std_pose, mean_velocity, displacement]).tolist()
