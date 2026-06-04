import numpy as np

POSE_DIM = 63       # 21 landmarks × 3 (x, y, z)
TEMPORAL_DIM = 315  # 63 × 5 features: mean_pose, std_pose, mean_velocity, displacement, path_length


def extract_temporal_features(frames: list[list[float]]) -> list[float]:
    """
    Extrai vetor temporal de 315 dims a partir de uma sequência de N frames (cada 63-dim):
      - mean_pose (63):     forma média da mão durante o gesto
      - std_pose (63):      variância por dimensão (≈0 em sinais estáticos)
      - mean_velocity (63): direção e magnitude média do movimento frame a frame
      - displacement (63):  deslocamento líquido (último frame − primeiro frame)
      - path_length (63):   distância acumulada por dimensão (Σ|Δf|)

    path_length resolve o "cancelamento": movimentos circulares ou de ida-e-volta
    têm displacement≈0 e mean_velocity≈0, mas path_length > 0.
    """
    if not frames:
        return [0.0] * TEMPORAL_DIM

    X = np.array(frames, dtype=np.float32)  # (N, 63)

    mean_pose = X.mean(axis=0)   # (63,)
    std_pose = X.std(axis=0)     # (63,)

    if len(frames) >= 2:
        deltas = np.diff(X, axis=0)              # (N-1, 63)
        mean_velocity = deltas.mean(axis=0)      # (63,)
        displacement = X[-1] - X[0]              # (63,)
        path_length = np.abs(deltas).sum(axis=0) # (63,)
    else:
        mean_velocity = np.zeros(POSE_DIM, dtype=np.float32)
        displacement = np.zeros(POSE_DIM, dtype=np.float32)
        path_length = np.zeros(POSE_DIM, dtype=np.float32)

    return np.concatenate([mean_pose, std_pose, mean_velocity, displacement, path_length]).tolist()
