"""Client-selection strategies.

RandomSelector   - the FedAvg default: m clients drawn uniformly without replacement.
AdaptiveSelector - score-based. For each client i, with every part min-max normalised to [0, 1]
                   across clients:

                   score_i = w_loss * loss_i + w_stale * staleness_i + w_size * size_i

                   loss_i       last local training loss reported by the client (higher = still
                                learning more). A never-selected client counts as the maximum so
                                every client is tried early.
                   staleness_i  rounds since the client was last selected (fairness).
                   size_i       number of local images.

                   The m highest scores are chosen (ties broken by client id, so runs are deterministic).
"""
from __future__ import annotations

import numpy as np


class RandomSelector:
    def __init__(self, n_clients: int, seed: int):
        self.n = n_clients
        self.rng = np.random.default_rng(seed)

    def select(self, m: int, round_idx: int) -> list[int]:
        return sorted(self.rng.choice(self.n, size=min(m, self.n), replace=False).tolist())

    def report(self, client: int, loss: float, round_idx: int) -> None:  # random selection ignores feedback
        pass


def _minmax(a: np.ndarray) -> np.ndarray:
    span = a.max() - a.min()
    return np.zeros_like(a, dtype=float) if span == 0 else (a - a.min()) / span


class AdaptiveSelector:
    def __init__(self, sizes: list[int], w_loss: float = 0.5, w_stale: float = 0.3, w_size: float = 0.2):
        self.sizes = np.asarray(sizes, dtype=float)
        self.n = len(sizes)
        self.w = (w_loss, w_stale, w_size)
        self.last_loss = np.full(self.n, np.nan)
        self.last_round = np.full(self.n, -1.0)  # -1 = never selected

    def scores(self, round_idx: int) -> np.ndarray:
        loss = self.last_loss.copy()
        known = ~np.isnan(loss)
        loss_n = np.ones(self.n)  # unknown loss -> maximum (explore)
        if known.any():
            loss_n[known] = _minmax(loss[known]) if known.sum() > 1 else 0.5
        stale = round_idx - self.last_round  # never selected -> largest staleness
        w_loss, w_stale, w_size = self.w
        return w_loss * loss_n + w_stale * _minmax(stale) + w_size * _minmax(self.sizes)

    def select(self, m: int, round_idx: int) -> list[int]:
        s = self.scores(round_idx)
        order = sorted(range(self.n), key=lambda i: (-s[i], i))
        chosen = sorted(order[: min(m, self.n)])
        for i in chosen:
            self.last_round[i] = round_idx
        return chosen

    def report(self, client: int, loss: float, round_idx: int) -> None:
        self.last_loss[client] = loss
