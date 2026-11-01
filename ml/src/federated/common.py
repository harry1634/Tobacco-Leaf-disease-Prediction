"""Data setup shared by the federated server and the simulated clients.

Server and every client call `get_data(...)` with the same arguments and therefore derive the SAME
train subset and client partition (all randomness is seeded). Results are cached per process.
"""
from __future__ import annotations

from functools import lru_cache

import numpy as np

from src.dataset.partition import dirichlet_partition, iid_partition
from src.dataset.tla import load_tla


@lru_cache(maxsize=4)
def get_data(img_size: int, include_synthetic: bool, num_clients: int, distribution: str,
             alpha: float, min_size: int, seed: int, max_train: int):
    """Return (data, parts): `data` as from load_tla, `parts` = list of train-index arrays, one per client.

    max_train > 0 keeps only a random subset of the training images (used for quick smoke tests).
    """
    data = load_tla(img_size, include_synthetic)
    x, y = data["train"]
    if max_train and max_train < len(y):
        keep = np.sort(np.random.default_rng(seed).permutation(len(y))[:max_train])
        data["train"] = (x[keep], y[keep])
        y = data["train"][1]
    if distribution == "iid":
        parts = iid_partition(y, num_clients, seed)
    elif distribution == "non-iid":
        parts = dirichlet_partition(y, num_clients, alpha, seed, min_size)
    else:
        raise ValueError(f"unknown distribution: {distribution}")
    return data, parts


def data_args(cfg: dict) -> tuple:
    """Turn a flat config dict (as sent in a Flower ConfigRecord) into get_data() arguments."""
    return (int(cfg["img_size"]), bool(cfg["include_synthetic"]), int(cfg["num_clients"]), str(cfg["distribution"]),
            float(cfg["alpha"]), int(cfg["min_size"]), int(cfg["seed"]), int(cfg["max_train"]))
