"""Flower ClientApp: one simulated farm/institution.

All settings arrive in the message's ConfigRecord, so this module needs no global configuration.
Reply payload (key "arrays"):
  compression "none" -> [delta]                (dense float32 update, 4 bytes/value)
  compression "topk" -> [indices, values, buffers]
                        indices/values: sparse update of the learned weights only (8 bytes/entry)
                        buffers: BatchNorm running statistics, always sent in full (they are not gradients)
where delta = locally trained weights - received global weights.
"""
from __future__ import annotations

import os

import numpy as np
import torch
from flwr.app import ArrayRecord, Context, Message, MetricRecord, RecordDict
from flwr.clientapp import ClientApp

from src.compression import topk
from src.federated.common import data_args, get_data
from src.models.mobilenet import buffer_mask, build_model, get_vector, set_vector
from src.training.local import train_local

app = ClientApp()


@app.query()
def query(msg: Message, context: Context) -> Message:
    """Tell the server which client index this node is and how many images it holds."""
    cfg = dict(msg.content["config"])
    _, parts = get_data(*data_args(cfg))
    pid = int(context.node_config["partition-id"])
    info = MetricRecord({"partition-id": pid, "num-examples": int(len(parts[pid]))})
    return Message(content=RecordDict({"info": info}), reply_to=msg)


@app.train()
def train(msg: Message, context: Context) -> Message:
    cfg = dict(msg.content["config"])
    torch.set_num_threads(int(cfg["threads"]))
    if cfg.get("force_cpu"):
        os.environ["FL_FORCE_CPU"] = "1"  # this worker process must stay off the GPU
    global_vec = msg.content["arrays"].to_numpy_ndarrays()[0]
    pid = int(context.node_config["partition-id"])
    rnd = int(cfg["server-round"])

    data, parts = get_data(*data_args(cfg))
    x, y = data["train"]
    idx = parts[pid]

    model = build_model(len(data["class_names"]), pretrained=False)
    set_vector(model, global_vec)
    loss = train_local(model, x[idx], y[idx], epochs=int(cfg["local_epochs"]), lr=float(cfg["lr"]),
                       batch_size=int(cfg["batch_size"]), seed=int(cfg["seed"]) * 100_003 + rnd * 101 + pid)
    delta = get_vector(model) - global_vec

    if cfg["compression"] == "topk":
        residual = None
        if bool(cfg["error_feedback"]) and "residual" in context.state:
            residual = context.state["residual"].to_numpy_ndarrays()[0]
        is_buf = buffer_mask(model)
        ids, vals, new_res = topk.compress(delta[~is_buf], float(cfg["topk_ratio"]), residual)
        if bool(cfg["error_feedback"]):
            context.state["residual"] = ArrayRecord([new_res])  # remembered for this client's next round
        payload = ArrayRecord([ids, vals, delta[is_buf].astype(np.float32)])
    else:
        payload = ArrayRecord([delta.astype(np.float32)])

    metrics = MetricRecord({"num-examples": int(len(idx)), "train-loss": float(loss), "partition-id": pid})
    return Message(content=RecordDict({"arrays": payload, "metrics": metrics}), reply_to=msg)
