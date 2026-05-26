import numpy as np


def filter_outliers(
    samples: list[list[float]], sigma: float = 3.0
) -> tuple[list[list[float]], int]:
    """
    Remove amostras que estão a mais de `sigma` desvios-padrão do centróide.
    Frames de transição captados durante a gravação tendem a ser outliers.
    Retorna (amostras_filtradas, n_removidos).
    """
    if len(samples) < 5:
        return samples, 0

    X = np.array(samples, dtype=np.float32)
    centroid = X.mean(axis=0)
    dists = np.linalg.norm(X - centroid, axis=1)

    cutoff = dists.mean() + sigma * dists.std()
    mask = dists <= cutoff

    filtered = X[mask].tolist()
    n_removed = int((~mask).sum())
    return filtered, n_removed
