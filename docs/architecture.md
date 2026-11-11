# Architecture

```
 Colab / local PC                                   Cloud                                  Browser
┌───────────────────────────────┐   result.json   ┌──────────────────────┐  Firebase JS  ┌──────────────┐
│ ml/  PyTorch + Flower         │ ─────────────►  │ Firestore            │ ◄──────────── │ Next.js app  │
│ Kaggle/HF data stays here     │  import script  │ users/{uid}/...      │  + rules      │ (on Vercel)  │
│ runs experiments A, B, C, D   │  (Admin SDK)    │ Firebase Auth        │               │ no training  │
└───────────────────────────────┘                 └──────────────────────┘               └──────────────┘
```

## Separation of concerns
- **`web/`** only displays data and handles login. It contains no training code and no secrets (the Firebase web config is public identifiers).
- **`ml/`** trains and evaluates. It writes plain JSON files to `ml/outputs/`.
- **`ml/src/export/import_to_firestore.py`** is the only bridge. It uses the Firebase Admin SDK with a service-account key kept on your own computer.
- **`firebase/firestore.rules`** is the security layer. The frontend route guard is only a convenience.

## Firestore data model
```
users/{uid}/experiments/{expId}        name, status, createdAt, config{}, summary{}, classNames[], perClass[], perClient[], confusionMatrix[{actual, counts[]}]
users/{uid}/experiments/{expId}/rounds/r001...   round, accuracy, macroPrecision, macroRecall, macroF1, trainLoss, valLoss, commBytes, uplinkBytes, downlinkBytes, selectedClients[]
users/{uid}/predictions/{id}           label, confidence, modelVersion?, createdAt   (metadata only, never images)
```
Firestore forbids nested arrays, so the confusion matrix is stored as a list of `{actual, counts}` objects.

| Path | Owner reads | Owner writes | Others |
|---|---|---|---|
| experiments, rounds | yes | **no** (import script only) | no |
| predictions | yes | create (validated), delete | no |
| anything else | no | no | no |

Metric fields that were not recorded are stored as missing/null and shown as "—" in the app; they are never turned into 0.

## Why the dataset is not in Firebase or Vercel
It is small but not ours to redistribute (the source repository states no explicit licence), and Firestore is meant for records, not image collections. The web app handles single uploaded images in the browser only.

## Federated round (what the code does)
1. `TobaccoStrategy.configure_train` picks clients (random or adaptive score).
2. Each `ClientApp.train` rebuilds the model from the global vector, trains locally, forms `delta = new - old`, and, for Top-k, sends the largest 10% of the learned-weight entries (indices + values), keeping the rest as an error-feedback residual. BatchNorm running statistics (1.5% of the model) are never compressed: they are sent in full alongside the sparse update, because a sparse, error-corrected update can make a variance negative and turn the model into NaN.
3. `aggregate_train` zero-fills the sparse weight updates, puts the dense BatchNorm statistics back, averages weighted by local image count, and adds the result to the global vector.
4. `evaluate_global` scores the new global model on the validation set and logs the round, including bytes.

## Observed trade-off
Top-k shrinks the **uplink** (a 10% Top-k update is 0.2x a dense one, since each kept entry costs 8 bytes against 4). The **downlink** is still the dense model for every selected client, so total traffic falls by less than the uplink does. Compressing the downlink too would be a separate extension.

## Testing
| What | How |
|---|---|
| Compression, selection, partitioning, metrics | `cd ml; python -m pytest tests -q` (14 tests) |
| Firestore security rules | `cd web; npm run test:rules` (10 tests, local emulator) |
| Python import to web read-back | `cd web; npm run test:import` (2 tests, local emulator) |
| Web code | `npm run lint`, `npx tsc --noEmit`, `npm run build` |
