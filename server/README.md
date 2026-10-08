# Cloud UKO demo trial backend

Small Express service with exactly two jobs:

1. `POST /api/create-payment` - a logged-in trial user wants to
   upgrade. Builds a signed PayFast payment request.
2. `POST /api/payfast-itn` - PayFast's webhook confirming a payment
   actually happened. Verified (signature, source host, PayFast's own
   validate callback, amount) before Supabase is updated.

See the root `README.md` → "Demo Trial System" for the full setup
walkthrough (Supabase project, `trial-config.js`, Render deploy).

## Local development

```bash
cp .env.example .env   # fill in real values - never commit this file
npm install
npm run dev
```

`GET /api/health` returns `{"ok":true}` once it's running.

## Deploying to Render

- New Web Service → this repo, **Root Directory: `server`**
- Build command: `npm install`
- Start command: `node index.js`
- Add every variable from `.env.example` under Environment, with real
  values (sandbox PayFast credentials to start - they're already
  filled in as examples, safe to use as-is for testing)
- Once deployed, put this service's Render URL into `SERVER_URL` here
  and into `trial-config.js`'s `BACKEND_URL` at the repo root
