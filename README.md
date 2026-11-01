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
- ML: dataset loader and audit, MobileNetV2, FedAvg on Flower, adaptive client selection, Top-k compression with error feedback, communication accounting, results export and import (20 unit tests; smoke runs of experiments A, B and D; the import-to-web path tested on the emulator).
- A centralised (non-federated) baseline classifier, trained on a Colab GPU: 84.1% accuracy and macro-F1 0.729 on 138 held-out test photos (about +/-6 points of uncertainty; four classes have a single test photo). Trained with `ml/colab/train_on_colab.ipynb`; the model file is not in the repository.
- A prediction service (`ml/src/serve/app.py`, FastAPI) and a diagnosis page with plain-language disease explanations. It works locally; it has not been tested on photos from other sources, and three informal checks on such photos were all wrong.

**Not done yet**
- **No real federated experiment results exist.** Only tiny smoke tests of A, B and D were run, to prove the code works. The dashboard is empty until you run the full experiments (recommended on a Colab GPU) and import them. No numbers have been invented.
- The prediction service runs only on a local PC. A deployed website shows "no model connected" until the service is hosted somewhere reachable.
- Experiment C (random selection + Top-k) has not had its own smoke run, though both its parts are exercised by A, B and D.
- Deployment to Vercel (see `docs/deployment.md`) is for you to do; the GPU path for the federated runs is untested.

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
