import type { Provider } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { getProviderClient } from "../integrations/registry.js";
import { HttpError } from "../middleware/errorHandler.js";
import { getValidTokens } from "./integrationAccountService.js";

/** Pulls the current device inventory from a provider and upserts it into the
 * local cache (Device table), which the rest of the app reads from. */
export async function syncDevicesForProvider(userId: string, provider: Provider) {
  const tokens = await getValidTokens(userId, provider);
  if (!tokens) {
    throw new HttpError(404, `No connected ${provider} account for this user`);
  }

  const account = await prisma.integrationAccount.findUniqueOrThrow({
    where: { userId_provider: { userId, provider } },
  });

  const client = getProviderClient(provider);
  const remoteDevices = await client.listDevices(tokens);

  const synced = await Promise.all(
    remoteDevices.map((device) =>
      prisma.device.upsert({
        where: { integrationAccountId_externalId: { integrationAccountId: account.id, externalId: device.externalId } },
        create: {
          userId,
          integrationAccountId: account.id,
          provider,
          externalId: device.externalId,
          name: device.name,
          deviceType: device.deviceType,
          stationExternalId: device.stationExternalId,
          capabilities: device.capabilities as object,
          lastSyncedAt: new Date(),
        },
        update: {
          name: device.name,
          deviceType: device.deviceType,
          stationExternalId: device.stationExternalId,
          capabilities: device.capabilities as object,
          lastSyncedAt: new Date(),
        },
      }),
    ),
  );

  return synced;
}

export async function refreshDeviceState(deviceId: string) {
  const device = await prisma.device.findUniqueOrThrow({ where: { id: deviceId } });
  const tokens = await getValidTokens(device.userId, device.provider);
  if (!tokens) {
    throw new HttpError(404, `No connected ${device.provider} account for this device`);
  }

  const client = getProviderClient(device.provider);
  const state = await client.getDeviceState(tokens, device.externalId, device.stationExternalId ?? undefined);

  return prisma.device.update({
    where: { id: deviceId },
    data: { lastState: state as object, lastSyncedAt: new Date() },
  });
}
