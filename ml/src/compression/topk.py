"""Top-k sparsification of a model update, with error feedback.

Client side:  compress(update, ratio, residual) -> (indices, values, new_residual)
Server side:  decompress(indices, values, size)  -> dense update (zeros where nothing was sent)

Error feedback: the entries that were NOT sent are stored in `residual` and added to the next
update, so information is delayed instead of lost.
Communication accounting counts the bytes of the arrays actually transmitted:
  dense  = 4 bytes per float32 value
  sparse = 4 bytes per index (int32) + 4 bytes per value (float32) for each kept entry
"""
from __future__ import annotations

import numpy as np

DENSE_BYTES_PER_VALUE = 4
SPARSE_BYTES_PER_ENTRY = 8


def k_for(size: int, ratio: float) -> int:
    if not 0 < ratio <= 1:
        raise ValueError("ratio must be in (0, 1]")
    return max(1, int(round(size * ratio)))


def compress(update: np.ndarray, ratio: float, residual: np.ndarray | None = None):
    """Keep the k entries with the largest |value| of (update + residual)."""
    corrected = update.astype(np.float32) + (residual if residual is not None else 0.0)
    k = k_for(corrected.size, ratio)
    idx = np.argpartition(np.abs(corrected), -k)[-k:]
    idx.sort()
    values = corrected[idx].astype(np.float32)
    new_residual = corrected.copy()
    new_residual[idx] = 0.0
    return idx.astype(np.int32), values, new_residual


def decompress(indices: np.ndarray, values: np.ndarray, size: int) -> np.ndarray:
    dense = np.zeros(size, dtype=np.float32)
    dense[indices] = values
    return dense


def dense_bytes(size: int) -> int:
    return size * DENSE_BYTES_PER_VALUE


def sparse_bytes(indices: np.ndarray, values: np.ndarray) -> int:
    return int(indices.nbytes + values.nbytes)
