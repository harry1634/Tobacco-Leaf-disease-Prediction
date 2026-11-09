# Adaptive Federated Learning for Tobacco Leaf Disease Diagnosis

B.Tech final-year project: a Next.js dashboard (`web/`) plus a separate Python PyTorch + Flower pipeline (`ml/`). Firebase provides login and stores imported results. The dataset never leaves your PC / Colab.

| Folder | What it is |
|---|---|
| `web/` | Next.js 16 + TypeScript + Tailwind + Recharts app (deploys to Vercel) |
| `ml/` | Dataset loading, MobileNetV2, Flower federated simulation, Top-k compression, adaptive selection, export |
| `firebase/` | Firestore security rules, indexes, emulator config |
| `docs/` | `architecture.md`, `setup-guide.md`, `deployment.md` |

## Quick start
```powershell
# web app
cd web ; copy .env.example .env.local   # fill in Firebase values, see docs/setup-guide.md
npm install ; npm run dev                # http://localhost:3000

# ML pipeline
cd ml ; python -m venv .venv ; .\.venv\Scripts\Activate.ps1
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu ; pip install -r requirements.txt
python -m pytest tests -q
```

## Status
**Built and tested**
- Web: landing, register / login / logout, protected routes, dashboard, experiments list and detail (per-class, per-client, confusion matrix), results charts with table views, project information page, diagnosis page (validation and preview).
- Firestore security rules, tested on the local emulator (10 tests).
- ML: dataset loader and audit, MobileNetV2, FedAvg on Flower, adaptive client selection, Top-k compression with error feedback, communication accounting, results export and import (24 unit tests; the import-to-web path tested on the emulator).
- A centralised (non-federated) baseline classifier, trained on a Colab GPU: 84.1% accuracy and macro-F1 0.729 on 138 held-out test photos (about +/-6 points of uncertainty; four classes have a single test photo). Trained with `ml/colab/train_on_colab.ipynb`; the model file is not in the repository.
- **The model deployed on the website (`web/api/_model/`, `final_all`) was retrained on all 1,398 real photos (train + validation + test) with the same recipe, 30 epochs, last epoch kept.** No unseen photos remain, so it has no measured score of its own (any score on the test photos would be meaningless because it has seen them). The 84.1% / 0.729 figures above come from the earlier model trained on the 1,122 training photos only, and are the best available estimate for the recipe, not a measurement of the deployed model.
- **The four federated experiments (A to D) were run once each** on Colab CPU (seed 42, 20 rounds, 8 simulated clients), with `ml/colab/federated_on_colab.ipynb`. Results are in `ml/outputs/*-full-s42/` (git-ignored) and summarised in `docs/Project_Report.pdf` section 10. In these single runs Top-k compression cut the upload by about 79% (729 MB to 155 MB) and total traffic by about 39%, with accuracy differences within the noise of the 138-photo test set (A 81.9%, B 84.8%, C 80.4%, D 81.9%); adaptive selection showed no consistent benefit. One seed only, so these are indications, not proof. Top-k compresses only the learned weights; BatchNorm statistics are sent in full (an earlier version that compressed them broke experiment C).
- A prediction service (`ml/src/serve/app.py`, FastAPI) and a diagnosis page with plain-language disease explanations. It works locally; it has not been tested on photos from other sources, and three informal checks on such photos were all wrong.

**Not done yet**
- **The federated results are not yet imported into Firebase**, so the Dashboard, FL experiments and Results pages are still empty. Extra random seeds (needed to support any claim about the two methods) have not been run. No numbers have been invented.
- The hosted prediction function (ONNX model, `web/api/predict.py`) is prepared for Vercel but its behaviour on Vercel was not verified in this report.
- Deployment to Vercel is described in `docs/deployment.md`. On the Colab GPU image used, the federated client processes crashed in PyTorch's CUDA dropout step, so the experiments ran on CPU (`--cpu`); the GPU path is unverified.

A full write-up with results, limitations and remaining work is in `docs/Project_Report.pdf`.

## Tests
| | |
|---|---|
| `cd ml; python -m pytest tests -q` | compression, selection, partitioning, metrics |
| `cd web; npm run test:rules` | Firestore rules on the emulator (needs Java) |
| `cd ml; python -m src.federated.run_experiment --exp D --smoke` then `cd web; npm run test:import` | Python import to web read-back |
| `cd web; npm run lint ; npx tsc --noEmit ; npm run build` | web checks |

## Credits and licence note
Data: Tobacco Leaf Abnormality (TLA) / TPDD by Hong Lin et al., Macao Polytechnic University (SPIE ICDIP 2022; Frontiers in Plant Science 2024). The source repository states no explicit licence; use for academic purposes with citation and do not redistribute the images.
