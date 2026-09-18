import { createHash } from "node:crypto";
import { env } from "../../config/env.js";
import { HttpError } from "../../middleware/errorHandler.js";
import type {
  ControlCommand,
  DeviceState,
  NormalizedDevice,
  PasswordCredentials,
  ProviderClient,
  ProviderTokens,
} from "../types.js";
import type {
  DeyeLatestDataResponse,
  DeyeOrderResponse,
  DeyeStationDeviceResponse,
  DeyeStationListResponse,
  DeyeTokenResponse,
} from "./types.js";

/** Deye Cloud Open Platform client.
 * Docs: https://developer.deyecloud.com — password-grant token, REST station/device
 * data, and an async order-then-poll pattern for control commands.
 */

const PAGE_SIZE = 100;
const MAX_PAGES = 20;
const ORDER_POLL_INTERVAL_MS = 2000;
const ORDER_POLL_MAX_ATTEMPTS = 30;

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

async function request<T>(path: string, init: { method: "GET" | "POST"; body?: unknown; accessToken?: string }): Promise<T> {
  const url = `${env.DEYE_BASE_URL}/v1.0${path}`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (init.accessToken) headers.Authorization = `bearer ${init.accessToken}`;

  const res = await fetch(url, {
    method: init.method,
    headers,
    body: init.body ? JSON.stringify(init.body) : undefined,
  });

  if (!res.ok) {
    throw new HttpError(502, `Deye Cloud API error: HTTP ${res.status}`);
  }

  const json = (await res.json()) as { code?: string | number; msg?: string };
  // Deye's success code is typically "0" / 0 / "1000000" depending on endpoint generation;
  // treat only explicit non-empty error codes as failures rather than guessing the exact success sentinel.
  if (json.code !== undefined && json.code !== null && String(json.code) !== "0" && json.msg) {
    throw new HttpError(502, `Deye Cloud API error ${json.code}: ${json.msg}`);
  }
  return json as T;
}

async function pollOrder(accessToken: string, orderId: string): Promise<void> {
  for (let attempt = 0; attempt < ORDER_POLL_MAX_ATTEMPTS; attempt++) {
    const result = await request<{ status: number; error?: string }>(`/order/${orderId}`, {
      method: "GET",
      accessToken,
    });
    if (result.status === 666) return; // success
    if (result.status !== 0 && result.status !== 100) {
      throw new HttpError(502, `Deye control command failed: ${result.error ?? `status ${result.status}`}`);
    }
    await new Promise((resolve) => setTimeout(resolve, ORDER_POLL_INTERVAL_MS));
  }
  throw new HttpError(504, "Deye control command timed out waiting for confirmation");
}

export const deyeClient: ProviderClient = {
  provider: "DEYE",
  authMode: "password",

  async loginWithPassword(credentials: PasswordCredentials): Promise<ProviderTokens> {
    const body = {
      appSecret: env.DEYE_APP_SECRET,
      email: credentials.email,
      password: sha256Hex(credentials.password),
      ...(credentials.companyId ? { companyId: credentials.companyId } : {}),
    };
    const json = await request<DeyeTokenResponse>(`/account/token?appId=${encodeURIComponent(env.DEYE_APP_ID)}`, {
      method: "POST",
      body,
    });

    if (!json.access_token) {
      throw new HttpError(401, json.msg ?? "Deye Cloud login failed");
    }

    return {
      accessToken: json.access_token,
      // Deye has no separate refresh-token endpoint; re-authenticating requires the
      // account credentials again, so we keep the pre-hashed password (never the
      // plaintext) to transparently re-login when the access token expires.
      refreshToken: body.password,
      expiresAt: json.expires_in ? new Date(Date.now() + json.expires_in * 1000) : undefined,
      externalAccountId: credentials.email,
      scope: credentials.companyId,
    };
  },

  async refreshTokens(tokens: ProviderTokens): Promise<ProviderTokens> {
    // `tokens.refreshToken` here is the pre-hashed password stored at login time;
    // Deye Cloud requires re-running the password grant rather than a distinct
    // refresh call, so we need the account email (externalAccountId) too.
    const email = tokens.externalAccountId;
    if (!email || !tokens.refreshToken) {
      throw new HttpError(401, "Deye Cloud session expired; reconnect the account to continue");
    }
    const companyId = tokens.scope;
    const body = {
      appSecret: env.DEYE_APP_SECRET,
      email,
      password: tokens.refreshToken,
      ...(companyId ? { companyId } : {}),
    };
    const json = await request<DeyeTokenResponse>(`/account/token?appId=${encodeURIComponent(env.DEYE_APP_ID)}`, {
      method: "POST",
      body,
    });
    return {
      accessToken: json.access_token,
      refreshToken: tokens.refreshToken,
      expiresAt: json.expires_in ? new Date(Date.now() + json.expires_in * 1000) : undefined,
      externalAccountId: email,
      scope: companyId,
    };
  },

  async listDevices(tokens: ProviderTokens): Promise<NormalizedDevice[]> {
    const devices: NormalizedDevice[] = [];

    for (let page = 1; page <= MAX_PAGES; page++) {
      const stationsRes = await request<DeyeStationListResponse>("/station/list", {
        method: "POST",
        accessToken: tokens.accessToken,
        body: { page, size: PAGE_SIZE },
      });
      const stations = stationsRes.stationList ?? [];
      if (stations.length === 0) break;

      for (const station of stations) {
        for (let devicePage = 1; devicePage <= MAX_PAGES; devicePage++) {
          const deviceRes = await request<DeyeStationDeviceResponse>("/station/device", {
            method: "POST",
            accessToken: tokens.accessToken,
            body: { page: devicePage, size: PAGE_SIZE, stationIds: [station.id] },
          });
          const items = deviceRes.deviceListItems ?? [];
          if (items.length === 0) break;

          for (const device of items) {
            devices.push({
              externalId: device.deviceSn,
              name: device.deviceName ?? device.deviceSn,
              deviceType: device.deviceType ?? "inverter",
              stationExternalId: String(station.id),
              capabilities: { stationName: station.name },
            });
          }
          if (items.length < PAGE_SIZE) break;
        }
      }
      if (stations.length < PAGE_SIZE) break;
    }

    return devices;
  },

  async getDeviceState(tokens: ProviderTokens, externalId: string): Promise<DeviceState> {
    const json = await request<DeyeLatestDataResponse>("/device/latest", {
      method: "POST",
      accessToken: tokens.accessToken,
      body: { deviceList: [externalId] },
    });

    const entry = json.deviceDataList?.find((d) => d.deviceSn === externalId);
    const state: DeviceState = {};
    for (const point of entry?.dataList ?? []) {
      const numeric = Number(point.value);
      state[point.key] = Number.isNaN(numeric) ? point.value : numeric;
    }
    return state;
  },

  async sendCommand(tokens: ProviderTokens, externalId: string, command: ControlCommand): Promise<void> {
    const path = command.actionType === "batteryModeControl" ? "/order/battery/modeControl" : "/order/customControl";
    const json = await request<DeyeOrderResponse>(path, {
      method: "POST",
      accessToken: tokens.accessToken,
      body: { deviceSn: externalId, ...command.params },
    });

    if (!json.orderId) {
      throw new HttpError(502, "Deye Cloud did not return an orderId for the control command");
    }
    await pollOrder(tokens.accessToken, json.orderId);
  },
};
