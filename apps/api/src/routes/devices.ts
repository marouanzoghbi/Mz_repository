import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { HttpError } from "../middleware/errorHandler.js";
import { refreshDeviceState } from "../services/deviceSyncService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const devicesRouter = Router();

devicesRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const { provider } = z.object({ provider: z.enum(["EWELINK", "DEYE"]).optional() }).parse(req.query);
    const devices = await prisma.device.findMany({
      where: { userId: req.userId, ...(provider ? { provider } : {}) },
      orderBy: { name: "asc" },
    });
    res.json({ devices });
  }),
);

devicesRouter.get(
  "/:id",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const device = await prisma.device.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!device) throw new HttpError(404, "Device not found");
    res.json({ device });
  }),
);

devicesRouter.post(
  "/:id/refresh",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const device = await prisma.device.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!device) throw new HttpError(404, "Device not found");
    const updated = await refreshDeviceState(device.id);
    res.json({ device: updated });
  }),
);
