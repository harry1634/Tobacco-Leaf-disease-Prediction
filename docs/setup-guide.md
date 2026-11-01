# Setup guide

## 1. Firebase (one time, in the browser)
1. https://console.firebase.google.com, **Create a project**, turn Google Analytics off.
2. Check the plan shown at the bottom left is **Spark** (free). Do not upgrade.
3. **Project settings, Your apps, Web (`</>`)**: register an app, leave Hosting unchecked. Copy the four values `apiKey`, `authDomain`, `projectId`, `appId`.
4. **Build, Authentication, Sign-in method**: enable **Email/Password**.
5. **Build, Firestore Database, Create database**: Standard edition, a region near you (cannot be changed later), **Production mode**.
6. **Firestore, Rules tab**: paste the contents of `firebase/firestore.rules` and **Publish**.
7. Skip **Storage**. New buckets may require the paid Blaze plan, and the app does not need it.

## 2. Run the web app
```powershell
cd web
copy .env.example .env.local     # then fill in the four NEXT_PUBLIC_FIREBASE_* values
npm install
npm run dev                      # http://localhost:3000
```
`.env.local` is git-ignored. Register an account in the app; it appears under **Authentication, Users** in the console.

## 3. Run the ML pipeline
See `ml/README.md`. Short version:
```powershell
cd ml
python -m venv .venv ; .\.venv\Scripts\Activate.ps1
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt
python -m pytest tests -q
python -m src.federated.run_experiment --exp D --smoke     # quick check, about 1-2 minutes
```

### Full runs on Google Colab (recommended)
CPU training of the full experiments takes hours; a free Colab GPU is much faster. Runtime must be set to GPU (Runtime, Change runtime type).
1. Upload the `ml/` folder to Google Drive (without `.venv`, `data/` and `outputs/`), or push the repo to GitHub and clone it.
2. In a notebook:
   ```python
   from google.colab import drive; drive.mount('/content/drive')
   %cd /content/drive/MyDrive/ml
   !pip install -q flwr[simulation] datasets scikit-learn pyyaml firebase-admin
   !python -m src.federated.run_all
   ```
   Colab already has PyTorch. The code uses the GPU automatically when PyTorch can see one (and the CPU otherwise). The GPU path has not been tested, because the development PC has no GPU; if it fails on Colab, send the error message.
3. Download `outputs/` (the `result.json` files) back to your PC.

Never put the Firebase service-account key into a Colab notebook that you share. Run the import on your own PC.

## 4. Import results into your dashboard
1. Firebase console, **Authentication, Users**: copy your account's **User UID**.
2. **Project settings, Service accounts, Generate new private key**. Save the file **outside the repo** (for example `C:\secrets\firebase-key.json`). Never commit or share it.
3. ```powershell
   cd ml
   python -m src.export.import_to_firestore --uid <YOUR_UID> --service-account C:\secrets\firebase-key.json
   ```
   Add `--dry-run` first to see what would be written. Re-running is safe: documents are replaced, not duplicated.
4. Reload the dashboard. Experiments, charts and the detail pages now show your runs.

## Troubleshooting
| Symptom | Fix |
|---|---|
| Dashboard says "Could not load experiments" | Publish the Firestore rules (step 1.6) and check `.env.local`. |
| Login says "operation not allowed" | Enable Email/Password (step 1.4). |
| `npm run test:*` says port 8080 is taken | `npm run emulator:stop`, then rerun. |
| A Flower run dies with "Failed to register worker to Raylet" | A transient Ray-on-Windows startup error. Run again; `run_all` retries automatically. |
