"""Split training data across simulated federated clients.

Both functions return a list with one array of sample indices per client. The result depends
only on (labels, n_clients, seed, alpha), so every experiment can reuse the exact same partition.
"""
from __future__ import annotations

import numpy as np


def iid_partition(labels: np.ndarray, n_clients: int, seed: int) -> list[np.ndarray]:
    """Class-stratified random split: every client sees roughly the same class mix."""
    rng = np.random.default_rng(seed)
    parts: list[list[int]] = [[] for _ in range(n_clients)]
    for c in np.unique(labels):
        idx = rng.permutation(np.where(labels == c)[0])
        for i, chunk in enumerate(np.array_split(idx, n_clients)):
            parts[i].extend(chunk.tolist())
    return [np.array(sorted(p), dtype=np.int64) for p in parts]


def dirichlet_partition(labels: np.ndarray, n_clients: int, alpha: float, seed: int, min_size: int = 10) -> list[np.ndarray]:
    """Non-IID split. For each class, client shares are drawn from Dirichlet(alpha).

    Small alpha (e.g. 0.3) gives very uneven class mixes; large alpha approaches IID.
    Re-draws until every client has at least `min_size` samples.
    """
    rng = np.random.default_rng(seed)
    classes = np.unique(labels)
    for _attempt in range(1000):
        parts: list[list[int]] = [[] for _ in range(n_clients)]
        for c in classes:
            idx = rng.permutation(np.where(labels == c)[0])
            share = rng.dirichlet(np.full(n_clients, alpha))
            cuts = (np.cumsum(share) * len(idx)).astype(int)[:-1]
            for i, chunk in enumerate(np.split(idx, cuts)):
                parts[i].extend(chunk.tolist())
        if min(len(p) for p in parts) >= min_size:
            return [np.array(sorted(p), dtype=np.int64) for p in parts]
    raise RuntimeError(f"Could not give every client >= {min_size} samples; lower min_size or raise alpha.")
