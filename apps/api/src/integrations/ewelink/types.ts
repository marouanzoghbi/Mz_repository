export interface EwelinkTokenResponse {
  error: number;
  msg?: string;
  data: {
    accessToken: string;
    refreshToken: string;
    atExpiredTime?: number;
    rtExpiredTime?: number;
    user?: { apikey?: string; countryCode?: string };
    region?: string;
  };
}

export interface EwelinkThingItem {
  itemType: number;
  itemData: {
    deviceid: string;
    name: string;
    productModel?: string;
    extra?: { uiid?: number; model?: string };
    online?: boolean;
    params?: Record<string, unknown>;
  };
}

export interface EwelinkThingListResponse {
  error: number;
  msg?: string;
  data: {
    thingList: EwelinkThingItem[];
    total?: number;
    index?: number;
  };
}

export interface EwelinkStatusResponse {
  error: number;
  msg?: string;
  data: Record<string, unknown>;
}
