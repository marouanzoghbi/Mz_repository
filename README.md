# Energy Automation Dashboard

A dashboard that connects your **eWeLink** (Sonoff smart home) and **Deye Cloud**
(solar inverter/battery) accounts in one place, and lets you build automations
that react to live device state across both platforms — e.g. *"if Deye battery
SOC drops below 20%, turn off eWeLink switch X"*.

## Architecture

Node.js/TypeScript monorepo (npm workspaces):

```
apps/api   Express + TypeScript backend, PostgreSQL via Prisma
apps/web   React + Vite + TypeScript frontend
```

- **Auth**: email/password, JWT-based sessions.
- **Integrations**: `apps/api/src/integrations/{ewelink,deye}` — each implements
  a shared `ProviderClient` interface (`apps/api/src/integrations/types.ts`),
  so device sync and the automation engine never branch on provider.
  - eWeLink connects via OAuth2 redirect.
  - Deye Cloud connects via direct account credentials (it has no OAuth
    redirect flow — see `docs/SETUP.md`).
- **Automations**: condition/state-based rules (`AutomationRule` ->
  `AutomationCondition`[] + `AutomationAction`[]). A background worker
  (`apps/api/src/worker/automationWorker.ts`) polls live device state on an
  interval, evaluates each enabled rule's conditions (AND/OR), and runs its
  actions when they're met, subject to a per-rule cooldown. Every run is
  logged to `AutomationRunLog` for the dashboard's activity feed.
- **Data**: PostgreSQL via Prisma (`apps/api/prisma/schema.prisma`).
  Third-party tokens/credentials are encrypted at rest (AES-256-GCM).

## Getting started

See [`docs/SETUP.md`](docs/SETUP.md) for full setup, including how to obtain
eWeLink and Deye Cloud developer credentials.

Quick start (with Docker for Postgres):

```bash
npm install
docker compose up -d                       # Postgres on localhost:5432
cp apps/api/.env.example apps/api/.env      # then fill in secrets (see SETUP.md)
npm run prisma:migrate --workspace apps/api
npm run dev                                 # API on :4000, web on :5173
```

## Deploying

The dashboard UI is responsive down to phone widths, so once deployed it's
usable from any device.

- **[`docs/DEPLOY_RENDER.md`](docs/DEPLOY_RENDER.md)** (recommended to start) —
  free, no credit card: a single Docker service (root `Dockerfile`, builds
  both apps and serves them from one Express process/one domain) on Render's
  free tier + a free Neon Postgres database. Tradeoff: the free instance
  spins down after ~15 min idle (first request after that takes ~30–50s).
- **[`docs/DEPLOY_RAILWAY.md`](docs/DEPLOY_RAILWAY.md)** — always-on, paid
  ($5+/mo): separate API and web services (`apps/api/Dockerfile` /
  `apps/web/Dockerfile`) + managed Postgres.

Both are generic Dockerfiles usable on any Docker host if you'd rather not use
either platform.

## Project layout

```
apps/api/src/
  config/          env loading + validation
  db/              Prisma client singleton
  integrations/    ewelink/ and deye/ provider clients + shared types
  middleware/      auth (JWT), error handling
  routes/          auth, integrations, devices, automations
  services/        credential encryption, device sync, automation engine/runner
  worker/          automation polling loop
apps/web/src/
  api/             fetch client
  hooks/           auth context
  pages/           Dashboard, Integrations, Devices, Automations (list + editor)
  types/           shared DTO types
```
