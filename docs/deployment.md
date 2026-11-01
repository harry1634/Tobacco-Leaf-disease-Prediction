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
