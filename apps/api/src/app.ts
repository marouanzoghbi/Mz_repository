import cors from "cors";
import express from "express";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { authRouter } from "./routes/auth.js";
import { automationsRouter } from "./routes/automations.js";
import { devicesRouter } from "./routes/devices.js";
import { integrationsRouter } from "./routes/integrations.js";
import { logger } from "./utils/logger.js";

// Populated by the production Docker build (the web app's Vite build output
// copied in alongside the compiled API) so a single service can serve both
// the API and the dashboard UI on one origin. Absent in local dev, where the
// web app runs on its own Vite dev server instead — see apps/web/vite.config.ts.
const webBuildDir = join(dirname(fileURLToPath(import.meta.url)), "../public");
const hasWebBuild = existsSync(join(webBuildDir, "index.html"));

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
  app.use(express.json());
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === "/health" } }));

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.use("/api/auth", authRouter);
  app.use("/api/integrations", integrationsRouter);
  app.use("/api/devices", devicesRouter);
  app.use("/api/automations", automationsRouter);

  if (hasWebBuild) {
    app.use(express.static(webBuildDir));
    // SPA fallback: any non-API GET that isn't a static asset resolves to
    // index.html so client-side routes (e.g. /automations/new) survive a refresh.
    app.get(/^(?!\/api|\/health).*/, (_req, res) => {
      res.sendFile(join(webBuildDir, "index.html"));
    });
  }

  app.use(errorHandler);

  return app;
}
