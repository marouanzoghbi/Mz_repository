# Deploying to Railway

This deploys three Railway services in one project: a managed **PostgreSQL**
database, the **API** (`apps/api`), and the **web** dashboard (`apps/web`).
Both apps build from their own `Dockerfile` at the repo root context — see
`apps/api/Dockerfile` and `apps/web/Dockerfile`.

## 1. Create the project

1. In Railway, **New Project** → **Deploy from GitHub repo** → select
   `marouanzoghbi/Mz_repository`.
2. Delete whatever default service Railway auto-creates from the repo root —
   you'll add the two services explicitly below (a plain Node/Nixpacks
   auto-detect won't work correctly on this Docker + npm-workspaces monorepo).

## 2. Add PostgreSQL

**New** → **Database** → **PostgreSQL**. Railway provisions it and exposes a
`DATABASE_URL` variable on that plugin that the other services can reference.

## 3. Add the API service

**New** → **GitHub Repo** → same repo again, as a second service.

**Settings**:
- **Root Directory**: `/` (repo root — the Dockerfile needs the workspace
  root `package.json`/lockfile in its build context)
- **Dockerfile Path**: `apps/api/Dockerfile`

**Variables** (Service → Variables):

| Variable | Value |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (Railway's reference syntax to the Postgres plugin) |
| `JWT_SECRET` | a long random string |
| `CREDENTIAL_ENCRYPTION_KEY` | 64 hex chars — `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `JWT_EXPIRES_IN` | `7d` (or leave default) |
| `WEB_ORIGIN` | the web service's public URL (set after step 4 — see step 5) |
| `EWELINK_APP_ID` / `EWELINK_APP_SECRET` / `EWELINK_REGION` | from dev.ewelink.cc (see `docs/SETUP.md`) |
| `EWELINK_REDIRECT_URI` | `https://<api-domain>/api/integrations/ewelink/callback` (see step 5) |
| `DEYE_APP_ID` / `DEYE_APP_SECRET` / `DEYE_BASE_URL` | from developer.deyecloud.com (see `docs/SETUP.md`) |
| `AUTOMATION_POLL_INTERVAL_MS` | `60000` (or leave default) |

Under **Settings → Networking**, click **Generate Domain** to get a public URL
for this service (e.g. `https://mz-api-production.up.railway.app`). You'll
need it in the next steps.

`apps/api/Dockerfile`'s start command runs `prisma migrate deploy` before
starting the server on every deploy, so the schema stays current automatically
— no manual migration step needed.

> **Don't scale this service beyond 1 replica.** The automation polling
> worker (`apps/api/src/worker/automationWorker.ts`) runs inside the API
> process itself; multiple replicas would each run their own worker and
> double-fire (or N-fire) every automation.

## 4. Add the web service

**New** → **GitHub Repo** → same repo, as a third service.

**Settings**:
- **Root Directory**: `/`
- **Dockerfile Path**: `apps/web/Dockerfile`

**Variables**:

| Variable | Value |
|---|---|
| `VITE_API_BASE_URL` | `https://<api-domain>/api` (the API service's public domain from step 3, **required at build time** — Vite bakes it into the static bundle) |

Generate a public domain for this service too (Settings → Networking →
Generate Domain), e.g. `https://mz-web-production.up.railway.app`.

## 5. Wire the two services together

Back on the **API** service, set:
- `WEB_ORIGIN` = the web service's public domain (from step 4) — this is
  used for CORS and for where the eWeLink OAuth callback redirects back to.
- `EWELINK_REDIRECT_URI` = `https://<api-domain>/api/integrations/ewelink/callback`

Redeploy the API service so the new variables take effect.

## 6. Register the production redirect URI with eWeLink

In the eWeLink Open Platform console (dev.ewelink.cc), add
`https://<api-domain>/api/integrations/ewelink/callback` as an allowed
redirect URI for your app — it must match `EWELINK_REDIRECT_URI` exactly.

## 7. Verify

- `https://<api-domain>/health` → `{"ok":true}`
- `https://<web-domain>/` → the login page loads and you can register/sign in
- Integrations → Connect eWeLink round-trips through the OAuth page back to
  `https://<web-domain>/integrations?connected=ewelink`

## Redeploys

Every push that Railway picks up rebuilds the relevant service's Docker image
and re-runs `prisma migrate deploy` on the API service automatically — no
extra steps for schema changes.
