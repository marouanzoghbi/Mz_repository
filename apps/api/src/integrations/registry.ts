import type { Provider } from "@prisma/client";
import type { ProviderClient } from "./types.js";
import { ewelinkClient } from "./ewelink/client.js";
import { deyeClient } from "./deye/client.js";

export const providerClients: Record<Provider, ProviderClient> = {
  EWELINK: ewelinkClient,
  DEYE: deyeClient,
};

export function getProviderClient(provider: Provider): ProviderClient {
  return providerClients[provider];
}
