"""Flower server side: FedAvg with pluggable client selection and Top-k update decompression.

The strategy subclasses Flower's FedAvg and overrides two steps:
  configure_train  - WHICH clients train this round (random or adaptive score)
  aggregate_train  - rebuild each client's update (dense, or sparse -> dense with zero fill),
                     then average them weighted by number of local images (FedAvg), and add the
                     result to the global weights.
Communication accounting (bytes actually carried by the arrays):
  downlink = size of the dense global vector x number of selected clients
  uplink   = sum of the arrays each client returned (dense delta, or int32 indices + float32 values)
"""
from __future__ import annotations

import numpy as np
from flwr.app import ArrayRecord, ConfigRecord, Message, MessageType, MetricRecord, RecordDict
from flwr.serverapp import Grid
from flwr.serverapp.strategy import FedAvg

from src.compression import topk
from src.evaluation.metrics import compute_metrics
from src.federated.common import data_args, get_data
from src.federated.selection import AdaptiveSelector, RandomSelector
from src.models.mobilenet import buffer_mask, build_model, set_vector
from src.training.local import evaluate


class TobaccoStrategy(FedAvg):
    def __init__(self, cfg: dict, class_names: list[str], val: tuple, selection: str, adaptive_w: tuple):
        super().__init__(fraction_train=1.0, fraction_evaluate=0.0, min_train_nodes=1, min_available_nodes=1)
        self.cfg = cfg
        self.class_names = class_names
        self.val = val
        self.m = int(cfg["clients_per_round"])
        self.n_clients = int(cfg["num_clients"])
        self.selection = selection
        self.adaptive_w = adaptive_w
        self.selector = None  # built after the handshake tells us each client's data size
        self.node_of: dict[int, int] = {}
        self.sizes: dict[int, int] = {}
        self.global_vec: np.ndarray | None = None
        self.model = build_model(len(class_names), pretrained=False)
        self.is_buf = buffer_mask(self.model)
        self.rounds: list[dict] = []
        self._pending: dict | None = None
        self.times_selected = {i: 0 for i in range(self.n_clients)}

    # ---- handshake: learn which node is which client index ----
    def _handshake(self, grid: Grid) -> None:
        nodes = list(grid.get_node_ids())
        rec = RecordDict({"config": ConfigRecord(dict(self.cfg))})
        msgs = [Message(content=rec, message_type=MessageType.QUERY, dst_node_id=n) for n in nodes]
        for reply in grid.send_and_receive(msgs, timeout=600):
            if reply.has_error():
                raise RuntimeError(f"client handshake failed: {reply.error.reason}")
            info = reply.content["info"]
            pid = int(info["partition-id"])
            self.node_of[pid] = int(reply.metadata.src_node_id)
            self.sizes[pid] = int(info["num-examples"])
        if sorted(self.node_of) != list(range(self.n_clients)):
            raise RuntimeError(f"expected clients 0..{self.n_clients - 1}, got {sorted(self.node_of)}")
        sizes = [self.sizes[i] for i in range(self.n_clients)]
        if self.selection == "adaptive":
            wl, ws, wz = self.adaptive_w
            self.selector = AdaptiveSelector(sizes, wl, ws, wz)
        else:
            self.selector = RandomSelector(self.n_clients, seed=int(self.cfg["seed"]) + 7)

    # ---- step 1: choose clients ----
    def configure_train(self, server_round: int, arrays: ArrayRecord, config: ConfigRecord, grid: Grid):
        if self.selector is None:
            self._handshake(grid)
        self.global_vec = arrays.to_numpy_ndarrays()[0]
        chosen = self.selector.select(self.m, server_round)
        for c in chosen:
            self.times_selected[c] += 1
        self._pending = {"round": server_round, "selected": chosen,
                         "downlinkBytes": int(self.global_vec.nbytes) * len(chosen)}
        config["server-round"] = server_round
        rec = RecordDict({"arrays": arrays, "config": config})
        return [Message(content=rec, message_type=MessageType.TRAIN, dst_node_id=self.node_of[c]) for c in chosen]

    # ---- step 2: rebuild and average updates ----
    def aggregate_train(self, server_round: int, replies):
        ok = [r for r in replies if not r.has_error()]
        for r in replies:
            if r.has_error():
                raise RuntimeError(f"client error in round {server_round}: {r.error.reason}")
        size = self.global_vec.size
        total = sum(int(r.content["metrics"]["num-examples"]) for r in ok)
        avg_delta = np.zeros(size, dtype=np.float32)
        uplink, loss_sum = 0, 0.0
        for r in ok:
            n = int(r.content["metrics"]["num-examples"])
            pid = int(r.content["metrics"]["partition-id"])
            loss = float(r.content["metrics"]["train-loss"])
            parts = r.content["arrays"].to_numpy_ndarrays()
            uplink += sum(int(a.nbytes) for a in parts)
            if len(parts) == 1:
                delta = parts[0]
            else:  # [indices, values, buffers]: sparse weights + dense BatchNorm statistics
                delta = np.zeros(size, dtype=np.float32)
                delta[~self.is_buf] = topk.decompress(parts[0], parts[1], int((~self.is_buf).sum()))
                delta[self.is_buf] = parts[2]
            avg_delta += (n / total) * delta
            loss_sum += (n / total) * loss
            self.selector.report(pid, loss, server_round)
        self.global_vec = (self.global_vec + avg_delta).astype(np.float32)
        if not np.isfinite(self.global_vec).all():  # fail loudly instead of running on with a broken model
            raise RuntimeError(f"the global model contains NaN/inf after round {server_round}")
        p = self._pending
        p.update(uplinkBytes=uplink, commBytes=uplink + p["downlinkBytes"], trainLoss=loss_sum,
                 selectedClients=[str(c) for c in p["selected"]])
        return ArrayRecord([self.global_vec]), MetricRecord({"train-loss": loss_sum})

    # ---- step 3: evaluate the new global model on the validation set ----
    def evaluate_global(self, server_round: int, arrays: ArrayRecord) -> MetricRecord:
        set_vector(self.model, arrays.to_numpy_ndarrays()[0])
        x, y = self.val
        loss, pred = evaluate(self.model, x, y)
        m = compute_metrics(y, pred, self.class_names)
        if server_round > 0:  # round 0 = the untrained starting model; nothing was communicated
            p = self._pending
            self.rounds.append({
                "round": server_round, "accuracy": m["accuracy"], "macroPrecision": m["macroPrecision"],
                "macroRecall": m["macroRecall"], "macroF1": m["macroF1"], "valLoss": loss,
                "trainLoss": p["trainLoss"], "commBytes": p["commBytes"], "uplinkBytes": p["uplinkBytes"],
                "downlinkBytes": p["downlinkBytes"], "selectedClients": p["selectedClients"],
            })
        return MetricRecord({"accuracy": m["accuracy"], "loss": loss})

    # ---- after training: final test-set and per-client evaluation ----
    def final_report(self) -> dict:
        set_vector(self.model, self.global_vec)
        data, parts = get_data(*data_args(self.cfg))
        xt, yt = data["test"]
        _, pred = evaluate(self.model, xt, yt)
        test = compute_metrics(yt, pred, self.class_names)
        x, y = data["train"]
        per_client = []
        for c in range(self.n_clients):
            _, p = evaluate(self.model, x[parts[c]], y[parts[c]])
            per_client.append({"clientId": str(c), "numSamples": int(len(parts[c])),
                               "timesSelected": self.times_selected[c], "accuracy": float((p == y[parts[c]]).mean())})
        return {"test": test, "perClient": per_client}
