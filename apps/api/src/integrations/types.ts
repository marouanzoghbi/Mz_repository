/** Shared shapes both provider clients normalize into, so the rest of the
 * app (device sync, automation engine, frontend) never branches on provider. */

export type ProviderName = "EWELINK" | "DEYE";

export interface NormalizedDevice {
  externalId: string;
  name: string;
  deviceType: string;
  /** Deye devices belong to a "station" (plant); eWeLink devices do not. */
  stationExternalId?: string;
  capabilities: Record<string, unknown>;
}

/** A flat bag of metric readings, e.g. { switch: "on" } or { batterySoc: 42, pvPower: 1800 }. */
export type DeviceState = Record<string, string | number | boolean>;

export interface ProviderTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  externalAccountId?: string;
  scope?: string;
  /** eWeLink tokens are region-pinned; unused by Deye. */
  region?: string;
}

export interface ControlCommand {
  /** Provider-specific action name, e.g. "setSwitch" (eWeLink) or "setRelay" (Deye). */
  actionType: string;
  params: Record<string, unknown>;
}

export interface PasswordCredentials {
  email: string;
  password: string;
  companyId?: string;
}

/** Common surface every provider client implements. Route/service code depends
 * only on this interface, never on a concrete client, so adding a third
 * provider later doesn't touch device sync or the automation engine.
 *
 * eWeLink connects via an OAuth2 redirect (authMode "oauth_redirect");
 * Deye Cloud exchanges the user's account credentials directly for a token
 * (authMode "password") — there is no redirect step for Deye. */
export interface ProviderClient {
  readonly provider: ProviderName;
  readonly authMode: "oauth_redirect" | "password";

  // oauth_redirect providers implement these:
  getAuthorizeUrl?(state: string): string;
  exchangeCodeForTokens?(code: string): Promise<ProviderTokens>;

  // password providers implement this:
  loginWithPassword?(credentials: PasswordCredentials): Promise<ProviderTokens>;

  /** Takes the full stored token record (not just the refresh token string) because
   * some providers (Deye) need other fields from it — e.g. the account email and
   * companyId — to re-authenticate. */
  refreshTokens(tokens: ProviderTokens): Promise<ProviderTokens>;
  listDevices(tokens: ProviderTokens): Promise<NormalizedDevice[]>;
  getDeviceState(tokens: ProviderTokens, externalId: string, stationExternalId?: string): Promise<DeviceState>;
  sendCommand(
    tokens: ProviderTokens,
    externalId: string,
    command: ControlCommand,
    stationExternalId?: string,
  ): Promise<void>;
}
