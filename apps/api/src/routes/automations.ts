import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { HttpError } from "../middleware/errorHandler.js";
import { runRuleNow } from "../services/automationRunner.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const automationsRouter = Router();

const conditionSchema = z.object({
  deviceId: z.string(),
  metric: z.string().min(1),
  operator: z.enum(["EQ", "NEQ", "GT", "GTE", "LT", "LTE"]),
  value: z.string().min(1),
});

const actionSchema = z.object({
  deviceId: z.string(),
  actionType: z.string().min(1),
  params: z.record(z.unknown()).default({}),
});

const ruleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  enabled: z.boolean().default(true),
  conditionLogic: z.enum(["AND", "OR"]).default("AND"),
  cooldownSeconds: z.number().int().min(0).default(300),
  conditions: z.array(conditionSchema).min(1),
  actions: z.array(actionSchema).min(1),
});

async function assertDevicesOwnedByUser(userId: string, deviceIds: string[]) {
  const owned = await prisma.device.count({ where: { id: { in: deviceIds }, userId } });
  if (owned !== new Set(deviceIds).size) {
    throw new HttpError(400, "One or more devices do not belong to this account");
  }
}

const ruleInclude = {
  conditions: { include: { device: { select: { id: true, name: true, provider: true } } }, orderBy: { order: "asc" as const } },
  actions: { include: { device: { select: { id: true, name: true, provider: true } } }, orderBy: { order: "asc" as const } },
};

automationsRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const rules = await prisma.automationRule.findMany({
      where: { userId: req.userId },
      include: { ...ruleInclude, runLogs: { orderBy: { triggeredAt: "desc" }, take: 3 } },
      orderBy: { createdAt: "desc" },
    });
    res.json({ rules });
  }),
);

automationsRouter.get(
  "/:id",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const rule = await prisma.automationRule.findFirst({
      where: { id: req.params.id, userId: req.userId },
      include: { ...ruleInclude, runLogs: { orderBy: { triggeredAt: "desc" }, take: 20 } },
    });
    if (!rule) throw new HttpError(404, "Automation rule not found");
    res.json({ rule });
  }),
);

automationsRouter.post(
  "/",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const input = ruleSchema.parse(req.body);
    const deviceIds = [...input.conditions.map((c) => c.deviceId), ...input.actions.map((a) => a.deviceId)];
    await assertDevicesOwnedByUser(req.userId!, deviceIds);

    const rule = await prisma.automationRule.create({
      data: {
        userId: req.userId!,
        name: input.name,
        description: input.description,
        enabled: input.enabled,
        conditionLogic: input.conditionLogic,
        cooldownSeconds: input.cooldownSeconds,
        conditions: {
          create: input.conditions.map((c, order) => ({ ...c, order })),
        },
        actions: {
          create: input.actions.map((a, order) => ({ ...a, params: a.params as object, order })),
        },
      },
      include: ruleInclude,
    });
    res.status(201).json({ rule });
  }),
);

automationsRouter.put(
  "/:id",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const existing = await prisma.automationRule.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!existing) throw new HttpError(404, "Automation rule not found");

    const input = ruleSchema.parse(req.body);
    const deviceIds = [...input.conditions.map((c) => c.deviceId), ...input.actions.map((a) => a.deviceId)];
    await assertDevicesOwnedByUser(req.userId!, deviceIds);

    const rule = await prisma.$transaction(async (tx) => {
      await tx.automationCondition.deleteMany({ where: { ruleId: existing.id } });
      await tx.automationAction.deleteMany({ where: { ruleId: existing.id } });
      return tx.automationRule.update({
        where: { id: existing.id },
        data: {
          name: input.name,
          description: input.description,
          enabled: input.enabled,
          conditionLogic: input.conditionLogic,
          cooldownSeconds: input.cooldownSeconds,
          conditions: { create: input.conditions.map((c, order) => ({ ...c, order })) },
          actions: { create: input.actions.map((a, order) => ({ ...a, params: a.params as object, order })) },
        },
        include: ruleInclude,
      });
    });
    res.json({ rule });
  }),
);

automationsRouter.patch(
  "/:id/toggle",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const { enabled } = z.object({ enabled: z.boolean() }).parse(req.body);
    const existing = await prisma.automationRule.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!existing) throw new HttpError(404, "Automation rule not found");

    const rule = await prisma.automationRule.update({ where: { id: existing.id }, data: { enabled } });
    res.json({ rule });
  }),
);

automationsRouter.delete(
  "/:id",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const existing = await prisma.automationRule.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!existing) throw new HttpError(404, "Automation rule not found");
    await prisma.automationRule.delete({ where: { id: existing.id } });
    res.status(204).send();
  }),
);

automationsRouter.post(
  "/:id/run",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const existing = await prisma.automationRule.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!existing) throw new HttpError(404, "Automation rule not found");
    await runRuleNow(existing.id);
    const latestLog = await prisma.automationRunLog.findFirst({
      where: { ruleId: existing.id },
      orderBy: { triggeredAt: "desc" },
    });
    res.json({ ran: true, latestLog });
  }),
);
