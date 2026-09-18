import { Router } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../config/env.js";
import { ewelinkClient } from "../integrations/ewelink/client.js";
import { deyeClient } from "../integrations/deye/client.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { HttpError } from "../middleware/errorHandler.js";
import {
  disconnectIntegrationAccount,
  listIntegrationAccounts,
  saveIntegrationAccount,
} from "../services/integrationAccountService.js";
import { syncDevicesForProvider } from "../services/deviceSyncService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const integrationsRouter = Router();

integrationsRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    res.json({ integrations: await listIntegrationAccounts(req.userId!) });
  }),
);

// --- eWeLink: OAuth2 redirect flow -----------------------------------------

integrationsRouter.get(
  "/ewelink/authorize-url",
  requireAuth,
  (req: AuthedRequest, res) => {
    if (!env.EWELINK_APP_ID) {
      throw new HttpError(400, "EWELINK_APP_ID/EWELINK_APP_SECRET are not configured on the server");
    }
    // The OAuth redirect can't carry our Authorization header, so we encode the
    // user id in a short-lived, signed `state` value and verify it on callback.
    const state = jwt.sign({ sub: req.userId, purpose: "ewelink_oauth" }, env.JWT_SECRET, { expiresIn: "10m" });
    res.json({ url: ewelinkClient.getAuthorizeUrl!(state) });
  },
);

integrationsRouter.get(
  "/ewelink/callback",
  asyncHandler(async (req, res) => {
    const { code, state } = z.object({ code: z.string(), state: z.string() }).parse(req.query);

    let userId: string;
    try {
      const payload = jwt.verify(state, env.JWT_SECRET) as { sub: string; purpose: string };
      if (payload.purpose !== "ewelink_oauth") throw new Error("wrong purpose");
      userId = payload.sub;
    } catch {
      throw new HttpError(400, "Invalid or expired OAuth state");
    }

    const tokens = await ewelinkClient.exchangeCodeForTokens!(code);
    await saveIntegrationAccount(userId, "EWELINK", tokens);
    await syncDevicesForProvider(userId, "EWELINK").catch(() => undefined); // best-effort initial sync

    res.redirect(`${env.WEB_ORIGIN}/integrations?connected=ewelink`);
  }),
);

// --- Deye Cloud: direct account credentials --------------------------------

const deyeConnectSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  companyId: z.string().optional(),
});

integrationsRouter.post(
  "/deye/connect",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    if (!env.DEYE_APP_ID) {
      throw new HttpError(400, "DEYE_APP_ID/DEYE_APP_SECRET are not configured on the server");
    }
    const credentials = deyeConnectSchema.parse(req.body);
    const tokens = await deyeClient.loginWithPassword!(credentials);
    await saveIntegrationAccount(req.userId!, "DEYE", tokens);
    await syncDevicesForProvider(req.userId!, "DEYE").catch(() => undefined);
    res.status(201).json({ connected: true });
  }),
);

// --- Shared --------------------------------------------------------------

integrationsRouter.delete(
  "/:provider",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const provider = z.enum(["EWELINK", "DEYE"]).parse(req.params.provider?.toUpperCase());
    await disconnectIntegrationAccount(req.userId!, provider);
    res.status(204).send();
  }),
);

integrationsRouter.post(
  "/:provider/sync",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const provider = z.enum(["EWELINK", "DEYE"]).parse(req.params.provider?.toUpperCase());
    const devices = await syncDevicesForProvider(req.userId!, provider);
    res.json({ synced: devices.length });
  }),
);
