export type Provider = "EWELINK" | "DEYE";

export interface User {
  id: string;
  email: string;
  name?: string | null;
}

export interface IntegrationAccountSummary {
  provider: Provider;
  connectedAt: string;
  region?: string | null;
  externalAccountId?: string | null;
}

export interface Device {
  id: string;
  provider: Provider;
  externalId: string;
  name: string;
  deviceType: string;
  stationExternalId?: string | null;
  capabilities: Record<string, unknown>;
  lastState: Record<string, string | number | boolean>;
  lastSyncedAt?: string | null;
}

export type ComparisonOperator = "EQ" | "NEQ" | "GT" | "GTE" | "LT" | "LTE";
export type ConditionLogic = "AND" | "OR";

export interface AutomationConditionInput {
  deviceId: string;
  metric: string;
  operator: ComparisonOperator;
  value: string;
}

export interface AutomationActionInput {
  deviceId: string;
  actionType: string;
  params: Record<string, unknown>;
}

export interface AutomationConditionDto extends AutomationConditionInput {
  id: string;
  device: { id: string; name: string; provider: Provider };
}

export interface AutomationActionDto extends AutomationActionInput {
  id: string;
  device: { id: string; name: string; provider: Provider };
}

export interface AutomationRunLog {
  id: string;
  triggeredAt: string;
  status: "SUCCESS" | "FAILURE" | "PARTIAL";
  conditionsSnapshot: unknown;
  actionsResult: unknown;
  errorMessage?: string | null;
}

export interface AutomationRule {
  id: string;
  name: string;
  description?: string | null;
  enabled: boolean;
  conditionLogic: ConditionLogic;
  cooldownSeconds: number;
  lastTriggeredAt?: string | null;
  conditions: AutomationConditionDto[];
  actions: AutomationActionDto[];
  runLogs?: AutomationRunLog[];
}
