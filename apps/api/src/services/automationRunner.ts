import type { Device } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { getProviderClient } from "../integrations/registry.js";
import type { DeviceState } from "../integrations/types.js";
import { logger } from "../utils/logger.js";
import { evaluateConditions } from "./automationEngine.js";
import { getValidTokens } from "./integrationAccountService.js";

const ruleWithRelations = {
  conditions: { include: { device: true } },
  actions: { include: { device: true } },
} as const;

/** Refreshes live state for every device referenced by at least one enabled rule,
 * once per device even if several rules watch it, then evaluates and (if due)
 * runs each rule. Intended to be called on a timer by the automation worker. */
export async function runAutomationTick(userId?: string): Promise<void> {
  const rules = await prisma.automationRule.findMany({
    where: { enabled: true, ...(userId ? { userId } : {}) },
    include: ruleWithRelations,
  });
  if (rules.length === 0) return;

  const deviceIds = new Set<string>();
  for (const rule of rules) {
    for (const c of rule.conditions) deviceIds.add(c.deviceId);
  }

  const stateByDeviceId = await refreshStates(Array.from(deviceIds));

  for (const rule of rules) {
    try {
      await evaluateAndRunRule(rule, stateByDeviceId);
    } catch (err) {
      logger.error({ err, ruleId: rule.id }, "Automation rule evaluation failed");
    }
  }
}

async function refreshStates(deviceIds: string[]): Promise<Map<string, DeviceState>> {
  const devices = await prisma.device.findMany({ where: { id: { in: deviceIds } } });
  const results = new Map<string, DeviceState>();

  await Promise.all(
    devices.map(async (device) => {
      try {
        const state = await fetchLiveState(device);
        results.set(device.id, state);
        await prisma.device.update({
          where: { id: device.id },
          data: { lastState: state as object, lastSyncedAt: new Date() },
        });
      } catch (err) {
        logger.warn({ err, deviceId: device.id }, "Failed to refresh device state; using last cached state");
        results.set(device.id, device.lastState as DeviceState);
      }
    }),
  );

  return results;
}

async function fetchLiveState(device: Device): Promise<DeviceState> {
  const tokens = await getValidTokens(device.userId, device.provider);
  if (!tokens) throw new Error(`No connected ${device.provider} account`);
  const client = getProviderClient(device.provider);
  return client.getDeviceState(tokens, device.externalId, device.stationExternalId ?? undefined);
}

type RuleWithRelations = Awaited<ReturnType<typeof prisma.automationRule.findMany<{ include: typeof ruleWithRelations }>>>[number];

async function evaluateAndRunRule(rule: RuleWithRelations, stateByDeviceId: Map<string, DeviceState>): Promise<void> {
  if (rule.cooldownSeconds > 0 && rule.lastTriggeredAt) {
    const elapsedMs = Date.now() - rule.lastTriggeredAt.getTime();
    if (elapsedMs < rule.cooldownSeconds * 1000) return;
  }

  const evaluableConditions = rule.conditions.map((c) => ({
    metric: c.metric,
    operator: c.operator,
    value: c.value,
    deviceState: stateByDeviceId.get(c.deviceId) ?? (c.device.lastState as DeviceState),
  }));

  const conditionsMet = evaluateConditions(evaluableConditions, rule.conditionLogic);
  if (!conditionsMet) return;

  const conditionsSnapshot = rule.conditions.map((c) => ({
    deviceId: c.deviceId,
    deviceName: c.device.name,
    metric: c.metric,
    operator: c.operator,
    expected: c.value,
    actual: (stateByDeviceId.get(c.deviceId) ?? (c.device.lastState as DeviceState))[c.metric] ?? null,
  }));

  const actionsResult: Array<{ actionId: string; deviceId: string; success: boolean; error?: string }> = [];

  for (const action of [...rule.actions].sort((a, b) => a.order - b.order)) {
    try {
      const tokens = await getValidTokens(action.device.userId, action.device.provider);
      if (!tokens) throw new Error(`No connected ${action.device.provider} account`);
      const client = getProviderClient(action.device.provider);
      await client.sendCommand(
        tokens,
        action.device.externalId,
        { actionType: action.actionType, params: action.params as Record<string, unknown> },
        action.device.stationExternalId ?? undefined,
      );
      actionsResult.push({ actionId: action.id, deviceId: action.deviceId, success: true });
    } catch (err) {
      actionsResult.push({
        actionId: action.id,
        deviceId: action.deviceId,
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const failures = actionsResult.filter((a) => !a.success).length;
  const status = failures === 0 ? "SUCCESS" : failures === actionsResult.length ? "FAILURE" : "PARTIAL";

  await prisma.$transaction([
    prisma.automationRunLog.create({
      data: {
        ruleId: rule.id,
        conditionsSnapshot,
        actionsResult,
        status,
        errorMessage: failures > 0 ? `${failures}/${actionsResult.length} action(s) failed` : null,
      },
    }),
    prisma.automationRule.update({ where: { id: rule.id }, data: { lastTriggeredAt: new Date() } }),
  ]);

  logger.info({ ruleId: rule.id, status, actionsResult }, "Automation rule triggered");
}

/** Runs a single rule immediately, ignoring cooldown — used by the "run now" API. */
export async function runRuleNow(ruleId: string): Promise<void> {
  const rule = await prisma.automationRule.findUniqueOrThrow({
    where: { id: ruleId },
    include: ruleWithRelations,
  });
  const deviceIds = Array.from(new Set(rule.conditions.map((c) => c.deviceId)));
  const stateByDeviceId = await refreshStates(deviceIds);
  await evaluateAndRunRule({ ...rule, lastTriggeredAt: null }, stateByDeviceId);
}
