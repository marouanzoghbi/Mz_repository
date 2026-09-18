# Setup guide

## 1. Prerequisites

- Node.js 20+
- PostgreSQL 14+ (via `docker compose up -d`, a local install, or a managed instance)

## 2. Install and configure

```bash
npm install
cp apps/api/.env.example apps/api/.env
```

Fill in `apps/api/.env`:

- `DATABASE_URL` — defaults match `docker-compose.yml`; change if using your own Postgres.
- `JWT_SECRET` — any long random string (e.g. `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`).
- `CREDENTIAL_ENCRYPTION_KEY` — **must be exactly 64 hex characters** (32 bytes). Generate with:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
  This encrypts stored eWeLink/Deye tokens at rest — losing it means every connected
  account has to be reconnected.
- `EWELINK_APP_ID` / `EWELINK_APP_SECRET` / `EWELINK_REGION` / `EWELINK_REDIRECT_URI` — see below.
- `DEYE_APP_ID` / `DEYE_APP_SECRET` / `DEYE_BASE_URL` — see below.

Then run migrations:

```bash
npm run prisma:migrate --workspace apps/api
```

## 3. Getting eWeLink Open Platform credentials

1. Register a developer account at <https://dev.ewelink.cc>.
2. Create an app to get an **App ID** and **App Secret**.
3. Register a redirect URI for your app matching `EWELINK_REDIRECT_URI`
   (default `http://localhost:4000/api/integrations/ewelink/callback`).
4. Set `EWELINK_REGION` to the region your *personal eWeLink account* is
   registered in (`us`, `eu`, `as`, or `cn`) — this is where the OAuth
   authorize page is hosted; eWeLink may also hand back a different region
   post-login, which the app stores per-connection automatically.
5. Put the App ID/Secret/redirect URI into `apps/api/.env`.

In the app, go to **Integrations** and click **Connect eWeLink** — you'll be
redirected to eWeLink's login/consent page and back.

## 4. Getting Deye Cloud Open Platform credentials

1. Register a developer account at <https://developer.deyecloud.com>.
2. Create an app to get an **App ID** and **App Secret**.
3. Set `DEYE_BASE_URL` to your account's regional gateway, e.g.
   `https://eu1-developer.deyecloud.com` or `https://us1-developer.deyecloud.com`.
4. Put the App ID/Secret into `apps/api/.env`.

Unlike eWeLink, Deye Cloud has no OAuth redirect — in the app, go to
**Integrations** and enter your **Deye Cloud account email + password**
directly (this is what Deye's own API requires; the app hashes the password
before it ever leaves the server and only stores the hash, never the
plaintext). A "Company ID" field is only needed for a business/organization
account — leave it blank for a personal account.

## 5. Running locally

```bash
npm run dev
```

- API: <http://localhost:4000> (health check at `/health`)
- Web: <http://localhost:5173>

The automation worker starts automatically with the API and polls every
`AUTOMATION_POLL_INTERVAL_MS` (default 60s) for enabled rules.

## 6. A note on the provider API integrations

The eWeLink and Deye Cloud clients (`apps/api/src/integrations/{ewelink,deye}`)
are implemented against each platform's documented request/response shapes and
auth flows. Field names for less-common responses (e.g. Deye's exact token
expiry field, some list-endpoint pagination edge cases) were reconstructed
from official sample code rather than exhaustively verified against live
traffic — if you hit an unexpected API error after connecting a real account,
check the error message (the clients surface the provider's own error
code/message) and compare against the current docs at dev.ewelink.cc /
developer.deyecloud.com; these are the two places worth checking first.

## 7. Building automations

An automation rule has:

- One or more **conditions** (`device` + `metric` + `operator` + `value`),
  combined with **AND** (all must hold) or **OR** (any must hold). `metric`
  is whatever key appears in that device's live state — e.g. `switch` for an
  eWeLink switch, or `batterySoc` / `pvPower` for a Deye device (run "Sync
  devices" then check a device's **State** column on the Devices page to see
  the exact keys your hardware reports).
- One or more **actions** (`device` + `actionType` + `params`), run in order
  when the conditions are met. `actionType`/`params` are provider-specific:
  - eWeLink: `actionType` is ignored (the device's `params` are sent as-is),
    e.g. params `{"switch": "off"}`.
  - Deye: `actionType: "batteryModeControl"` with params like
    `{"batteryModeType": "GRID_CHARGE", "action": "off"}`, or
    `actionType: "customControl"` with a raw Modbus `content` hex string for
    anything not covered by the higher-level battery-mode endpoint.
- A **cooldown** (seconds) preventing the rule from re-firing immediately
  after it runs.

Use **Run now** on the Automations page to test a rule immediately (it still
requires conditions to be met, but skips the cooldown).
