import type { Provider } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { getProviderClient } from "../integrations/registry.js";
import type { ProviderTokens } from "../integrations/types.js";
import { decryptSecret, encryptSecret } from "./credentialCrypto.js";

// Refresh this long before actual expiry so a request never races an expiring token.
const REFRESH_SKEW_MS = 5 * 60 * 1000;

export async function saveIntegrationAccount(userId: string, provider: Provider, tokens: ProviderTokens) {
  return prisma.integrationAccount.upsert({
    where: { userId_provider: { userId, provider } },
    create: {
      userId,
      provider,
      externalAccountId: tokens.externalAccountId,
      region: tokens.region,
      accessTokenEnc: encryptSecret(tokens.accessToken),
      refreshTokenEnc: tokens.refreshToken ? encryptSecret(tokens.refreshToken) : null,
      tokenExpiresAt: tokens.expiresAt,
      scope: tokens.scope,
    },
    update: {
      externalAccountId: tokens.externalAccountId,
      region: tokens.region,
      accessTokenEnc: encryptSecret(tokens.accessToken),
      refreshTokenEnc: tokens.refreshToken ? encryptSecret(tokens.refreshToken) : undefined,
      tokenExpiresAt: tokens.expiresAt,
      scope: tokens.scope,
    },
  });
}

export async function getDecryptedTokens(userId: string, provider: Provider): Promise<ProviderTokens | null> {
  const account = await prisma.integrationAccount.findUnique({
    where: { userId_provider: { userId, provider } },
  });
  if (!account) return null;

  return {
    accessToken: decryptSecret(account.accessTokenEnc),
    refreshToken: account.refreshTokenEnc ? decryptSecret(account.refreshTokenEnc) : undefined,
    expiresAt: account.tokenExpiresAt ?? undefined,
    externalAccountId: account.externalAccountId ?? undefined,
    scope: account.scope ?? undefined,
    region: account.region ?? undefined,
  };
}

/** Returns a usable access token for the given account, transparently refreshing
 * (and persisting the refreshed tokens) when the stored one is expired or about to be. */
export async function getValidTokens(userId: string, provider: Provider): Promise<ProviderTokens | null> {
  const tokens = await getDecryptedTokens(userId, provider);
  if (!tokens) return null;

  const isExpiring = tokens.expiresAt && tokens.expiresAt.getTime() - Date.now() < REFRESH_SKEW_MS;
  if (!isExpiring) return tokens;

  const client = getProviderClient(provider);
  const refreshed = await client.refreshTokens(tokens);
  await saveIntegrationAccount(userId, provider, refreshed);
  return refreshed;
}

export async function disconnectIntegrationAccount(userId: string, provider: Provider) {
  await prisma.integrationAccount.deleteMany({ where: { userId, provider } });
}

export async function listIntegrationAccounts(userId: string) {
  const accounts = await prisma.integrationAccount.findMany({ where: { userId } });
  return accounts.map((a) => ({
    provider: a.provider,
    connectedAt: a.connectedAt,
    region: a.region,
    externalAccountId: a.externalAccountId,
  }));
}
