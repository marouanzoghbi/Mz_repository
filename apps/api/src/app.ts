import cors from "cors";
import express from "express";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { authRouter } from "./routes/auth.js";
import { automationsRouter } from "./routes/automations.js";
import { devicesRouter } from "./routes/devices.js";
import { integrationsRouter } from "./routes/integrations.js";
import { logger } from "./utils/logger.js";

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

  app.use(errorHandler);

  return app;
}
