import { env } from "../config/env.js";
import { runAutomationTick } from "../services/automationRunner.js";
import { logger } from "../utils/logger.js";

let timer: NodeJS.Timeout | undefined;
let tickInFlight = false;

async function tick() {
  if (tickInFlight) return; // skip overlapping runs if one tick takes longer than the interval
  tickInFlight = true;
  try {
    await runAutomationTick();
  } catch (err) {
    logger.error({ err }, "Automation worker tick failed");
  } finally {
    tickInFlight = false;
  }
}

export function startAutomationWorker(): void {
  if (timer) return;
  logger.info({ intervalMs: env.AUTOMATION_POLL_INTERVAL_MS }, "Starting automation worker");
  timer = setInterval(tick, env.AUTOMATION_POLL_INTERVAL_MS);
  void tick(); // run once immediately on startup rather than waiting for the first interval
}

export function stopAutomationWorker(): void {
  if (timer) clearInterval(timer);
  timer = undefined;
}
