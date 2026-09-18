# Deploying to Render + Neon (free, no credit card)

This deploys the dashboard as **one** service — the root `Dockerfile` builds
both `apps/api` and `apps/web` and serves the dashboard UI + the API from a
single Express process on one domain (see `apps/api/src/app.ts`'s static
file + SPA fallback handling). No CORS or cross-origin API URL to configure.

Database is [Neon](https://neon.tech) (Postgres, free tier, no card). Hosting
is [Render](https://render.com) (free web service tier, no card).

> **Free-tier tradeoff**: Render's free web services spin down after ~15
> minutes of no traffic. The first request after that takes ~30–50s to wake
> back up (subsequent requests are fast). Fine for a personal dashboard;
> annoying if you want it always-instant — see `docs/DEPLOY_RAILWAY.md` for a
> paid always-on alternative.

## 1. Create the database (Neon)

1. Go to <https://neon.tech>, sign up (GitHub login works, no card required).
2. Create a project (any name/region).
3. On the project dashboard, copy the **connection string** — use the plain
   (non-pooled) one, i.e. the hostname does **not** contain `-pooler`. It
   looks like:
   ```
   postgresql://<user>:<password>@ep-xxxx.<region>.aws.neon.tech/<dbname>?sslmode=require
   ```
   Save this — it's your `DATABASE_URL`.

## 2. Create the web service (Render)

1. Go to <https://render.com>, sign up (no card required for the free tier).
2. **New** → **Web Service** → connect your GitHub account → select
   `marouanzoghbi/Mz_repository`.
3. Configure:
   - **Root Directory**: leave blank (repo root)
   - **Runtime**: **Docker** (Render will find the `Dockerfile` at the repo root automatically)
   - **Instance Type**: **Free**
4. Under **Environment Variables**, add:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | the Neon connection string from step 1 |
   | `JWT_SECRET` | a long random string |
   | `CREDENTIAL_ENCRYPTION_KEY` | 64 hex chars — `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
   | `EWELINK_APP_ID` / `EWELINK_APP_SECRET` / `EWELINK_REGION` | from dev.ewelink.cc (see `docs/SETUP.md`) |
   | `DEYE_APP_ID` / `DEYE_APP_SECRET` / `DEYE_BASE_URL` | from developer.deyecloud.com (see `docs/SETUP.md`) |

   Leave `WEB_ORIGIN` and `EWELINK_REDIRECT_URI` unset for now — you'll fill
   those in after the first deploy, once you know the service's URL.
   Leave `VITE_API_BASE_URL` unset entirely — it's not needed for this
   single-service setup (same-origin, no separate web service/domain).

5. Click **Create Web Service**. The first build takes a few minutes (it's
   building a Docker image from scratch). `prisma migrate deploy` runs
   automatically as part of the container's start command, so the database
   schema is created on that first boot — no manual migration step.

## 3. Wire up the real URL

Once it's deployed, Render shows the service's public URL, e.g.
`https://mz-dashboard.onrender.com`. Go back to **Environment Variables** and
add:

| Variable | Value |
|---|---|
| `WEB_ORIGIN` | `https://mz-dashboard.onrender.com` (your actual URL) |
| `EWELINK_REDIRECT_URI` | `https://mz-dashboard.onrender.com/api/integrations/ewelink/callback` |

Saving triggers a redeploy (fast — no rebuild needed, just a restart with new
env vars).

## 4. Register the redirect URI with eWeLink

In the eWeLink Open Platform console (dev.ewelink.cc), add
`https://mz-dashboard.onrender.com/api/integrations/ewelink/callback` as an
allowed redirect URI for your app — it must match `EWELINK_REDIRECT_URI`
exactly.

## 5. Verify

- `https://mz-dashboard.onrender.com/health` → `{"ok":true}`
- `https://mz-dashboard.onrender.com/` → the dashboard loads; register an
  account and sign in
- From your phone browser, open the same URL — the layout is responsive

## Redeploys

Every push Render picks up rebuilds the image and re-runs
`prisma migrate deploy` automatically — no extra steps for schema changes.
