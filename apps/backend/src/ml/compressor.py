import numpy as np
from sklearn.cluster import MiniBatchKMeans


def compress_samples(samples: list[list[float]], n_clusters: int = 20) -> list[list[float]]:
    """
    Reduz amostras a n_clusters centroids via MiniBatchKMeans.
    Se o número de amostras já é ≤ n_clusters, retorna sem modificar.
    Isso reduz ~150 amostras × 63 floats (~75 KB) para 20 × 63 (~10 KB).
    """
    if len(samples) <= n_clusters:
        return samples

    X = np.array(samples, dtype=np.float32)
    k = min(n_clusters, len(samples))
    kmeans = MiniBatchKMeans(n_clusters=k, random_state=42, n_init=3)
    kmeans.fit(X)
    return kmeans.cluster_centers_.tolist()
