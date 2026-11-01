# Deploying the web app to Vercel (Hobby plan)

Nothing here has been done for you: deploying and creating accounts are your decisions. Only `web/` is deployed; the ML pipeline is never deployed.

## Before you start
- `cd web; npm run lint; npm run build` should both pass (they do as of this writing).
- The Firestore rules must be published (see `docs/setup-guide.md`).
- No secret belongs on Vercel. Only the four public `NEXT_PUBLIC_FIREBASE_*` values (and optionally `NEXT_PUBLIC_INFERENCE_URL`) are needed. **Never** add the service-account key to Vercel.

## Steps
1. Push the repository to GitHub (create an empty repo, then `git remote add origin ...` and `git push`). Check `git status` first: `.env.local`, `ml/data/` and key files must not be listed.
2. https://vercel.com, **Sign up with GitHub**, choose **Hobby**, and do not add a card.
3. **Add New, Project**, import the repo.
4. Set **Root Directory** to `web` (the app is not at the repo root).
5. Framework preset: Next.js (auto-detected). Leave build and output settings at their defaults.
6. Under **Environment Variables** add the four `NEXT_PUBLIC_FIREBASE_*` values from your `.env.local`.
7. **Deploy**. Vercel gives you a `*.vercel.app` URL.
8. Back in the Firebase console, **Authentication, Settings, Authorized domains**: add that `*.vercel.app` domain, or login will fail on the live site.

## Verify the live site
- Landing page loads; Register and Login work; you stay logged in after reload.
- Visiting `/dashboard` while logged out sends you to `/login`.
- After importing results, the dashboard, experiments and results pages show them.
- Check browser dev tools, Console: no red errors.

## Limits to keep in mind
- Vercel Hobby is for non-commercial personal use, with monthly bandwidth and function-usage caps. A student demo is far below them. Check current limits at vercel.com/pricing before relying on them.
- Firebase Spark has daily Firestore quotas (reads, writes, storage). This app reads a few documents per page view. Check current numbers in the Firebase pricing page.
- Real image diagnosis needs a separately hosted model service. The service is built (`ml/src/serve/app.py`) but only runs on your own PC so far. PyTorch does not fit in a Vercel serverless function, and a free host may sleep or be slow. Until the service is hosted somewhere reachable, leave `NEXT_PUBLIC_INFERENCE_URL` empty on Vercel and the diagnosis page will show "no model connected".

## Real predictions on the deployed site (ONNX function on Vercel)

Hugging Face Docker Spaces now need a paid plan, so the model runs as a Vercel Python function instead, next to the website (same address, free Hobby plan, no second host).

- `web/api/predict.py` is the function. It uses `onnxruntime` (no PyTorch) and the converted model in `web/api/_model/` (about 9 MB, committed to git). `web/vercel.json` bundles that folder and `web/requirements.txt` lists the Python packages.
- The model was converted with `python -m src.serve.export_onnx` (in `ml`), which checks the ONNX model against the PyTorch original on every test photo: 138 of 138 identical predictions, largest logit difference 5e-06.
- `web/api/_preprocess.py` is a copy of `ml/src/serve/preprocess.py`; a test fails if they ever differ.
- Vercel accepts request bodies up to 4.5 MB, so the diagnosis page shrinks large photos (longest side 1600 px, JPEG) before sending them.

**To switch it on:** in Vercel, Settings, Environment Variables, set `NEXT_PUBLIC_INFERENCE_URL` to `/api/predict` (a relative address, no domain), then Redeploy. Locally nothing changes: `next dev` does not run Python functions, so keep using `python -m src.serve.app` with `NEXT_PUBLIC_INFERENCE_URL=http://127.0.0.1:8000/predict` in `.env.local`.

**Not yet verified on Vercel itself** (it has only been tested locally): that Vercel builds the Python function inside the Next.js project, that the model file is bundled, the cold-start time, and the function time limit on the Hobby plan. After redeploying, open `https://<your-site>/api/predict`; it should return `{"status":"ok","classes":16,...}`. If it returns 404 or a build error, send me the Vercel build log.

If the model is retrained, re-run the export, commit the new `web/api/_model/` files, and redeploy. The trained model comes from a dataset licensed for academic use with citation, so check that publishing the weights in a public repository suits you; a private repository avoids the question.
