"""MobileNetV2 classifier plus helpers to move model weights to/from a flat float32 vector.

Federated learning exchanges the model as one flat vector made of every floating-point entry of
the state dict (weights, biases, BatchNorm running statistics). Integer counters
(num_batches_tracked) are not exchanged.
"""
from __future__ import annotations

import numpy as np
import torch
from torch import nn
from torchvision import models


def build_model(num_classes: int, pretrained: bool = True) -> nn.Module:
    weights = models.MobileNet_V2_Weights.IMAGENET1K_V1 if pretrained else None
    model = models.mobilenet_v2(weights=weights)
    model.classifier[1] = nn.Linear(model.last_channel, num_classes)
    return model


def float_keys(model: nn.Module) -> list[str]:
    return [k for k, v in model.state_dict().items() if v.is_floating_point()]


def get_vector(model: nn.Module) -> np.ndarray:
    sd = model.state_dict()
    return np.concatenate([sd[k].detach().cpu().numpy().astype(np.float32).ravel() for k in float_keys(model)])


def set_vector(model: nn.Module, vec: np.ndarray) -> None:
    sd = model.state_dict()
    offset = 0
    for k in float_keys(model):
        n = sd[k].numel()
        sd[k].copy_(torch.from_numpy(vec[offset:offset + n].reshape(sd[k].shape)))
        offset += n
    if offset != vec.size:
        raise ValueError(f"vector has {vec.size} values but the model needs {offset}")


def buffer_mask(model: nn.Module) -> np.ndarray:
    """True for the entries of the flat vector that are BatchNorm running statistics (not learned weights).

    Running statistics are not gradients (a variance can never be negative), so compression must not touch them.
    """
    sd = model.state_dict()
    parts = [np.full(sd[k].numel(), k.endswith(("running_mean", "running_var")), dtype=bool) for k in float_keys(model)]
    return np.concatenate(parts)
