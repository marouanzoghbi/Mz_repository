// Field naming for a successful token response isn't fully confirmed against
// live traffic (see docs/SETUP.md) — accept both snake_case and camelCase,
// and both flat and `data`-nested shapes, since different Deye API generations
// use different conventions. extractTokenFields() in client.ts normalizes this.
export interface DeyeTokenResponse {
  access_token?: string;
  accessToken?: string;
  refresh_token?: string;
  refreshToken?: string;
  expires_in?: number;
  expiresIn?: number;
  token_type?: string;
  msg?: string;
  code?: string | number;
  data?: {
    access_token?: string;
    accessToken?: string;
    refresh_token?: string;
    refreshToken?: string;
    expires_in?: number;
    expiresIn?: number;
  };
}

export interface DeyeStation {
  id: number;
  name: string;
  regionNationId?: number;
}

export interface DeyeStationListResponse {
  stationList: DeyeStation[];
  total?: number;
  msg?: string;
  code?: string | number;
}

export interface DeyeDevice {
  deviceSn: string;
  deviceName?: string;
  deviceType?: string;
  stationId?: number;
}

export interface DeyeStationDeviceResponse {
  deviceListItems: DeyeDevice[];
  msg?: string;
  code?: string | number;
}

export interface DeyeLatestDataResponse {
  deviceDataList?: Array<{ deviceSn: string; dataList: Array<{ key: string; value: string; unit?: string }> }>;
  msg?: string;
  code?: string | number;
}

export interface DeyeOrderResponse {
  orderId?: string;
  msg?: string;
  code?: string | number;
}
