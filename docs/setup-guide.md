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

### Full runs on Google Colab (tested)
Use the notebook `ml/colab/federated_on_colab.ipynb` (upload it to Colab with File, Upload notebook). It walks through every step: upload the code zip (`python colab\make_zip.py` creates `ml/ml_for_colab.zip`), install, a smoke test, experiments A to D, a Drive backup, the comparison and the download.
- **Run on the CPU.** On the Colab GPU image we tested, the client processes crashed inside PyTorch's CUDA dropout step. The notebook's section 3b switches everything to the CPU (`--cpu`), which worked: about 14 minutes per experiment (20 rounds), roughly an hour for all four. The GPU path remains unverified.
- Colab resets lose everything in `/content`, so run the notebook's Drive backup cell after each experiment.
- Extra seeds (`--seed N`) are in the notebook's last section; compare one seed at a time with `python -m src.export.compare --seed 42`.
- Download `fl_results.zip` and unzip it into `ml/outputs/` on your PC.

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
