"""Training and evaluation on in-memory uint8 image arrays (shared by centralised and federated runs)."""
from __future__ import annotations

import math
import os

import numpy as np
import torch
import torch.nn.functional as F
from torch import nn

_MEAN = torch.tensor([0.485, 0.456, 0.406]).view(1, 3, 1, 1)
_STD = torch.tensor([0.229, 0.224, 0.225]).view(1, 3, 1, 1)


def gpu_allowed() -> bool:
    """True when a GPU exists and FL_FORCE_CPU=1 is not set (a workaround if GPU workers crash)."""
    return torch.cuda.is_available() and os.environ.get("FL_FORCE_CPU") != "1"


def pick_device() -> torch.device:
    """Use the GPU when PyTorch can see one (for example on Colab), otherwise the CPU."""
    return torch.device("cuda" if gpu_allowed() else "cpu")


def _strong_augment(x: torch.Tensor, gen: torch.Generator | None) -> torch.Tensor:
    """Random rotation (+/-30 deg), zoom-in (up to 25%) and contrast/saturation jitter.

    Leaf photos have no fixed orientation, so rotation is a safe augmentation. Hue is left alone
    because colour is itself a disease cue.
    """
    n = x.shape[0]
    ang = (torch.rand(n, generator=gen) * 2 - 1) * math.radians(30)
    zoom = 1.0 - 0.25 * torch.rand(n, generator=gen)  # <1 samples a smaller window = zoom in
    cos, sin = torch.cos(ang) * zoom, torch.sin(ang) * zoom
    shift = (torch.rand(n, 2, generator=gen) * 2 - 1) * (1 - zoom).unsqueeze(1)
    theta = torch.stack([torch.stack([cos, -sin, shift[:, 0]], 1), torch.stack([sin, cos, shift[:, 1]], 1)], 1)
    grid = F.affine_grid(theta, list(x.shape), align_corners=False)
    x = F.grid_sample(x, grid, padding_mode="reflection", align_corners=False)
    mean = x.mean(dim=(1, 2, 3), keepdim=True)
    x = mean + (x - mean) * (0.8 + 0.4 * torch.rand(n, 1, 1, 1, generator=gen))  # contrast +/-20%
    gray = x.mean(dim=1, keepdim=True)
    x = gray + (x - gray) * (0.8 + 0.4 * torch.rand(n, 1, 1, 1, generator=gen))  # saturation +/-20%
    return x.clamp(0, 1)


def _prepare(xb: np.ndarray, augment: bool, gen: torch.Generator | None, strong: bool = False) -> torch.Tensor:
    x = torch.from_numpy(xb).float() / 255.0
    if augment:
        if strong:
            x = _strong_augment(x, gen)
        n = x.shape[0]
        flip_h = torch.rand(n, generator=gen) < 0.5
        flip_v = torch.rand(n, generator=gen) < 0.5
        x = torch.where(flip_h.view(-1, 1, 1, 1), x.flip(3), x)
        x = torch.where(flip_v.view(-1, 1, 1, 1), x.flip(2), x)
        x = (x * (0.9 + 0.2 * torch.rand(n, 1, 1, 1, generator=gen))).clamp(0, 1)  # brightness +/-10%
    return (x - _MEAN) / _STD


def train_local(model: nn.Module, x: np.ndarray, y: np.ndarray, *, epochs: int, lr: float, batch_size: int,
                seed: int, momentum: float = 0.9, weight_decay: float = 1e-4, augment: bool = True,
                strong_augment: bool = False, label_smoothing: float = 0.0,
                class_weights: np.ndarray | None = None) -> float:
    """Train in place with SGD. Returns the mean training loss over the last epoch.

    The last three options are off by default so the federated runs are unchanged.
    """
    device = pick_device()
    model.to(device)
    model.train()
    opt = torch.optim.SGD(model.parameters(), lr=lr, momentum=momentum, weight_decay=weight_decay)
    weight = None if class_weights is None else torch.from_numpy(class_weights).float().to(device)
    loss_fn = nn.CrossEntropyLoss(weight=weight, label_smoothing=label_smoothing)
    rng = np.random.default_rng(seed)
    gen = torch.Generator().manual_seed(seed)
    last = float("nan")
    for _ in range(epochs):
        order = rng.permutation(len(y))
        total, count = 0.0, 0
        for s in range(0, len(order), batch_size):
            idx = order[s:s + batch_size]
            if len(idx) < 2:  # BatchNorm needs more than one sample in train mode
                continue
            xb = _prepare(x[idx], augment, gen, strong_augment).to(device)
            yb = torch.from_numpy(y[idx]).to(device)
            opt.zero_grad()
            loss = loss_fn(model(xb), yb)
            loss.backward()
            opt.step()
            total += loss.item() * len(idx)
            count += len(idx)
        last = total / max(count, 1)
    return last


@torch.no_grad()
def evaluate(model: nn.Module, x: np.ndarray, y: np.ndarray, batch_size: int = 64) -> tuple[float, np.ndarray]:
    """Return (mean cross-entropy loss, predicted class indices)."""
    device = pick_device()
    model.to(device)
    model.eval()
    loss_fn = nn.CrossEntropyLoss(reduction="sum")
    total, preds = 0.0, []
    for s in range(0, len(y), batch_size):
        logits = model(_prepare(x[s:s + batch_size], False, None).to(device))
        total += loss_fn(logits, torch.from_numpy(y[s:s + batch_size]).to(device)).item()
        preds.append(logits.argmax(1).cpu().numpy())
    return total / max(len(y), 1), (np.concatenate(preds) if preds else np.array([], dtype=np.int64))
