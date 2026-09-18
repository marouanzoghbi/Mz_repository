import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { startAutomationWorker, stopAutomationWorker } from "./worker/automationWorker.js";

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`API listening on http://localhost:${env.PORT}`);
  startAutomationWorker();
});

function shutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down`);
  stopAutomationWorker();
  server.close(() => process.exit(0));
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
