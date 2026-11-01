import numpy as np
import pytest

from src.compression import topk
from src.dataset.partition import dirichlet_partition, iid_partition
from src.evaluation.metrics import compute_metrics, rounds_to_convergence
from src.federated.selection import AdaptiveSelector, RandomSelector


# ---------------- Top-k compression ----------------
def test_topk_keeps_largest_magnitudes():
    u = np.array([0.1, -5.0, 0.2, 3.0, -0.3, 0.0], dtype=np.float32)
    idx, vals, _ = topk.compress(u, ratio=2 / 6)
    assert idx.tolist() == [1, 3]
    assert vals.tolist() == [-5.0, 3.0]


def test_topk_reconstruction_zero_fills():
    u = np.array([0.1, -5.0, 0.2, 3.0], dtype=np.float32)
    idx, vals, _ = topk.compress(u, ratio=0.5)
    dense = topk.decompress(idx, vals, u.size)
    assert dense.tolist() == [0.0, -5.0, 0.0, 3.0]


def test_error_feedback_conserves_total_update():
    rng = np.random.default_rng(0)
    u = rng.normal(size=1000).astype(np.float32)
    idx, vals, residual = topk.compress(u, 0.1)
    sent = topk.decompress(idx, vals, u.size)
    assert np.allclose(sent + residual, u, atol=1e-6)  # nothing is lost: sent + remembered == original


def test_residual_is_added_to_next_update():
    u1 = np.array([1.0, 0.9, 0.0, 0.0], dtype=np.float32)
    _, _, res = topk.compress(u1, 0.25)  # sends index 0, remembers 0.9 at index 1
    idx, vals, _ = topk.compress(np.array([0, 0.2, 0, 0], dtype=np.float32), 0.25, res)
    assert idx.tolist() == [1] and vals[0] == pytest.approx(1.1)


def test_byte_accounting():
    idx, vals, _ = topk.compress(np.ones(1000, dtype=np.float32), 0.1)
    assert topk.sparse_bytes(idx, vals) == 100 * topk.SPARSE_BYTES_PER_ENTRY
    assert topk.dense_bytes(1000) == 4000


def test_invalid_ratio_rejected():
    with pytest.raises(ValueError):
        topk.k_for(10, 0)


# ---------------- Client selection ----------------
def test_random_selector_size_unique_and_seeded():
    a, b = RandomSelector(10, seed=1), RandomSelector(10, seed=1)
    s = a.select(4, 0)
    assert len(s) == 4 and len(set(s)) == 4
    assert s == b.select(4, 0)


def test_adaptive_tries_every_client_before_repeating():
    sel = AdaptiveSelector(sizes=[10] * 6)
    first = sel.select(3, 0)
    for c in first:
        sel.report(c, 1.0, 0)
    second = sel.select(3, 1)
    assert set(first).isdisjoint(second)  # unseen clients (max loss + max staleness) go first


def test_adaptive_prefers_high_loss_clients():
    sel = AdaptiveSelector(sizes=[10] * 4, w_loss=1.0, w_stale=0.0, w_size=0.0)
    sel.select(4, 0)
    for c, loss in enumerate([0.1, 2.0, 0.5, 1.0]):
        sel.report(c, loss, 0)
    assert sel.select(2, 1) == [1, 3]


# ---------------- Partitioning ----------------
def _labels():
    return np.repeat(np.arange(4), 50)


@pytest.mark.parametrize("fn", [lambda y: iid_partition(y, 5, 0), lambda y: dirichlet_partition(y, 5, 0.5, 0, 5)])
def test_partitions_cover_each_sample_exactly_once(fn):
    y = _labels()
    parts = fn(y)
    flat = np.concatenate(parts)
    assert sorted(flat.tolist()) == list(range(len(y)))


def test_partition_is_deterministic_and_noniid_is_skewed():
    y = _labels()
    assert all(np.array_equal(a, b) for a, b in zip(dirichlet_partition(y, 5, 0.3, 7, 5), dirichlet_partition(y, 5, 0.3, 7, 5)))
    iid_spread = np.std([np.bincount(y[p], minlength=4) for p in iid_partition(y, 5, 0)])
    non_spread = np.std([np.bincount(y[p], minlength=4) for p in dirichlet_partition(y, 5, 0.1, 0, 5)])
    assert non_spread > iid_spread


# ---------------- Metrics ----------------
def test_metrics_perfect_and_macro_vs_accuracy():
    names = ["a", "b", "c"]
    y = np.array([0, 0, 0, 0, 1, 2])
    m = compute_metrics(y, y, names)
    assert m["accuracy"] == 1.0 and m["macroF1"] == 1.0
    # Always predicting the majority class: accuracy looks OK, macro-F1 exposes it.
    m2 = compute_metrics(y, np.zeros_like(y), names)
    assert m2["accuracy"] == pytest.approx(4 / 6) and m2["macroF1"] < 0.4
    assert m2["confusionMatrix"][0]["counts"] == [4, 0, 0]


def test_rounds_to_convergence():
    assert rounds_to_convergence([0.2, 0.5, 0.795, 0.8, 0.8]) == 3
    assert rounds_to_convergence([]) is None


def test_strong_augment_keeps_shape_range_and_changes_pixels():
    import numpy as np
    import torch
    from src.training.local import _prepare

    xb = np.random.default_rng(0).integers(0, 256, size=(4, 3, 32, 32), dtype=np.uint8)
    plain = _prepare(xb, False, None)
    aug = _prepare(xb, True, torch.Generator().manual_seed(1), strong=True)
    assert aug.shape == plain.shape and torch.isfinite(aug).all()
    assert not torch.allclose(aug, plain)
