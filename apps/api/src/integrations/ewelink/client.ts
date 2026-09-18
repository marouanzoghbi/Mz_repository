import { env } from "../../config/env.js";
import { HttpError } from "../../middleware/errorHandler.js";
import type {
  ControlCommand,
  DeviceState,
  NormalizedDevice,
  ProviderClient,
  ProviderTokens,
} from "../types.js";
import { generateNonce, signMessage } from "./sign.js";
import type { EwelinkStatusResponse, EwelinkThingListResponse, EwelinkTokenResponse } from "./types.js";

/** eWeLink (CoolKit) Open Platform v2 client.
 * Docs: https://dev.ewelink.cc — region-pinned REST gateway + HMAC-signed auth.
 */

function regionBaseUrl(region: string): string {
  const tld = region === "cn" ? "cn" : "cc"; // cn tenants use the .cn TLD variant
  return `https://${region}-apia.coolkit.${tld}`;
}

function authHeaders(body: unknown) {
  return {
    "Content-Type": "application/json",
    "X-CK-Appid": env.EWELINK_APP_ID,
    Authorization: `Sign ${signMessage(JSON.stringify(body), env.EWELINK_APP_SECRET)}`,
  };
}

async function request<T>(
  region: string,
  path: string,
  init: { method: "GET" | "POST"; body?: unknown; accessToken?: string },
): Promise<T> {
  const url = `${regionBaseUrl(region)}${path}`;
  const headers: Record<string, string> = init.accessToken
    ? { "Content-Type": "application/json", Authorization: `Bearer ${init.accessToken}` }
    : authHeaders(init.body ?? {});

  const res = await fetch(url, {
    method: init.method,
    headers,
    body: init.body ? JSON.stringify(init.body) : undefined,
  });

  if (!res.ok) {
    throw new HttpError(502, `eWeLink API error: HTTP ${res.status}`);
  }

  const json = (await res.json()) as { error: number; msg?: string };
  if (json.error && json.error !== 0) {
    throw new HttpError(502, `eWeLink API error ${json.error}: ${json.msg ?? "unknown error"}`);
  }
  return json as T;
}

function normalizeDevice(item: { itemData: { deviceid: string; name: string; productModel?: string; extra?: { uiid?: number; model?: string }; params?: Record<string, unknown> } }): NormalizedDevice {
  return {
    externalId: item.itemData.deviceid,
    name: item.itemData.name,
    deviceType: item.itemData.extra?.model ?? item.itemData.productModel ?? "unknown",
    capabilities: { uiid: item.itemData.extra?.uiid, params: Object.keys(item.itemData.params ?? {}) },
  };
}

export const ewelinkClient: ProviderClient = {
  provider: "EWELINK",
  authMode: "oauth_redirect",

  getAuthorizeUrl(state: string): string {
    const seq = Date.now().toString();
    const nonce = generateNonce();
    const authorization = signMessage(`${env.EWELINK_APP_ID}_${seq}`, env.EWELINK_APP_SECRET);

    const params = new URLSearchParams({
      clientId: env.EWELINK_APP_ID,
      redirectUrl: env.EWELINK_REDIRECT_URI,
      grantType: "authorization_code",
      state,
      nonce,
      seq,
      showQRCode: "false",
      authorization,
    });
    return `https://c2ccdn.coolkit.cc/oauth/index.html?${params.toString()}`;
  },

  async exchangeCodeForTokens(code: string): Promise<ProviderTokens> {
    const body = { redirectUrl: env.EWELINK_REDIRECT_URI, code, grantType: "authorization_code" };
    const json = await request<EwelinkTokenResponse>(env.EWELINK_REGION, "/v2/user/oauth/token", {
      method: "POST",
      body,
    });

    return {
      accessToken: json.data.accessToken,
      refreshToken: json.data.refreshToken,
      expiresAt: json.data.atExpiredTime ? new Date(json.data.atExpiredTime) : undefined,
      externalAccountId: json.data.user?.apikey,
      region: json.data.region ?? env.EWELINK_REGION,
    };
  },

  async refreshTokens(tokens: ProviderTokens): Promise<ProviderTokens> {
    if (!tokens.refreshToken) {
      throw new HttpError(401, "eWeLink session expired; reconnect the account to continue");
    }
    const region = tokens.region ?? env.EWELINK_REGION;
    const body = { rt: tokens.refreshToken };
    const json = await request<EwelinkTokenResponse>(region, "/v2/user/refresh", {
      method: "POST",
      body,
    });

    return {
      accessToken: json.data.accessToken,
      refreshToken: json.data.refreshToken,
      expiresAt: json.data.atExpiredTime ? new Date(json.data.atExpiredTime) : undefined,
      region,
    };
  },

  async listDevices(tokens: ProviderTokens): Promise<NormalizedDevice[]> {
    const region = tokens.region ?? env.EWELINK_REGION;
    const json = await request<EwelinkThingListResponse>(region, "/v2/device/thing?lang=en&num=0", {
      method: "GET",
      accessToken: tokens.accessToken,
    });
    return json.data.thingList.filter((t) => t.itemType === 1).map(normalizeDevice);
  },

  async getDeviceState(tokens: ProviderTokens, externalId: string): Promise<DeviceState> {
    const region = tokens.region ?? env.EWELINK_REGION;
    const json = await request<EwelinkStatusResponse>(
      region,
      `/v2/device/thing/status?type=1&id=${encodeURIComponent(externalId)}`,
      { method: "GET", accessToken: tokens.accessToken },
    );
    const params = (json.data.params ?? json.data) as Record<string, unknown>;
    const state: DeviceState = {};
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        state[key] = value;
      }
    }
    return state;
  },

  async sendCommand(tokens: ProviderTokens, externalId: string, command: ControlCommand): Promise<void> {
    const region = tokens.region ?? env.EWELINK_REGION;
    await request(region, "/v2/device/thing/status", {
      method: "POST",
      accessToken: tokens.accessToken,
      body: { type: 1, id: externalId, params: command.params },
    });
  },
};
