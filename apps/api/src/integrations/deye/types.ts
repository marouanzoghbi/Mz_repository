export interface DeyeTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  msg?: string;
  code?: string | number;
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
