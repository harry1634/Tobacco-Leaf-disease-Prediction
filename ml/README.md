# ML and federated-learning pipeline

Python code that trains the tobacco-leaf classifier, simulates federated learning with Flower, and exports results for the web dashboard. It never runs on Vercel.

## Setup (Windows, Python 3.12)
```powershell
cd ml
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt
```
The first run downloads the dataset (about 50 MB) from Hugging Face into `data/raw/` and builds a resized cache in `data/processed/`. Both folders are git-ignored.

## Dataset
Tobacco Leaf Abnormality (TLA), 16 classes, from `TamAko783/TPDD_Honglin_CLS` on Hugging Face. It is a re-split of the TPDD/TLA data by Lin et al. (Macao Polytechnic University). The source repository states no explicit licence, so use it for academic work only, **cite the original papers**, and do not redistribute the images.

Inspect it yourself: `python src/dataset/inspect_dataset.py` (splits, classes) and `python src/dataset/audit_dataset.py` (real vs synthetic counts, duplicate checks).

Rules applied in code (`src/dataset/tla.py`):
- Only real photographs are used. Files with `_paste` or `_aug` in the name are synthetic and excluded; the loader asserts none appear outside the train split.
- The published train / validation / test split is kept as is (it is leaf-group aware, which prevents near-duplicate leakage). Our audit found 0 exact duplicates and no file-name overlap between splits.
- Four classes (anthracnose, black_shank, genetic_abnormality, tswv) have only 1 validation and 1 test image, so their individual scores are unreliable. The web app flags this.

## Commands (run from `ml/`)
| Task | Command |
|---|---|
| Unit tests | `python -m pytest tests -q` |
| Centralised baseline | `python -m src.training.centralised` |
| One experiment (A to D) | `python -m src.federated.run_experiment --exp A` |
| Quick pipeline check of one | `python -m src.federated.run_experiment --exp D --smoke` |
| All four, then compare | `python -m src.federated.run_all` |
| Compare finished runs | `python -m src.export.compare` (add `--seed 42` to compare one seed) |
| All four on a Colab GPU | open `colab/federated_on_colab.ipynb` |
| Import into Firestore | `python -m src.export.import_to_firestore --uid <UID> --service-account <key.json>` |

Smoke runs use 4 clients, 2 rounds and 160 images. They only prove the code runs. They are labelled "(smoke test)" and are excluded from comparisons and imports unless you pass `--include-smoke`.

**Run time:** on a 4-core CPU a single image costs about 0.15 s to train at 160 px, so the full experiments take hours. Use Google Colab with a GPU for the real runs (see `docs/setup-guide.md`).

## The four experiments
All share the model, data, client partition, seed, starting weights and training settings from `configs/base.yaml`. Only these differ:

| | Client selection | Update sent |
|---|---|---|
| A | random | dense |
| B | adaptive score | dense |
| C | random | Top-k |
| D | adaptive score | Top-k |

**Adaptive selection** (`src/federated/selection.py`): score = 0.5 x normalised last local loss + 0.3 x normalised rounds since last selected + 0.2 x normalised local data size. A client never selected counts as the highest loss. The top m scores are chosen; ties go to the lower client id.

**Top-k compression** (`src/compression/topk.py`): the client update (trained weights minus received weights) keeps the 10% of the **learned-weight** entries with the largest magnitude. BatchNorm running statistics (1.5% of the entries) are not gradients, so they are always sent in full; compressing them made the shared model NaN in an early run of experiment C. The server stops a run immediately if the shared model ever contains NaN. Error feedback keeps the unsent values on the client and adds them to the next update. The server rebuilds a dense update by zero-filling and averages updates weighted by client data size (FedAvg).

**Communication accounting** (`src/federated/server.py`): bytes of the arrays actually carried. Downlink = dense global vector x selected clients. Uplink = dense update (4 bytes per value) or Top-k (4-byte index + 4-byte value per kept weight entry, plus the dense BatchNorm statistics). Protocol overhead is not counted.

**Convergence:** `roundsToConvergence` is the first round whose validation accuracy is within 1 percentage point of the best that run reached. `compare.py` also reports rounds to a common target accuracy.

**Evaluation:** validation set each round (to track training); the test set is used once, at the end, for the reported accuracy, macro precision / recall / F1, per-class table and confusion matrix. Per-client accuracy is the final global model evaluated on each client's own training images, so read it as how well the model fits each client's data, not as generalisation.

## What is tested
`pytest` covers compression (selection of largest values, zero-fill reconstruction, error feedback conserving the update, byte counts), client selection, partitioning, metrics, the weight/BatchNorm split, the CPU switch and the prediction service (24 tests). The four full experiments were run on Colab (see `colab/federated_on_colab.ipynb`); smoke runs check the pipeline quickly; the import path is verified by `npm run test:import` in `web/`.

## Improving the centralised model (Colab)

`src/training/centralised.py` has optional improvements, all off by default: `--cosine` (learning-rate decay), `--lr`,
`--strong-aug` (rotation, zoom, contrast and saturation jitter), `--label-smoothing`, `--balance` (loss weighted by
1/sqrt(class frequency)) and `--img-size`. Use `--skip-test` while tuning so choices are made on validation only, then run
`python -m src.training.final_test --out <run>` once; it refuses to evaluate the test set a second time.

For a GPU, run `python colab/make_zip.py`, upload `colab/train_on_colab.ipynb` to Colab and follow its cells.
The federated experiments are unaffected by these options.
