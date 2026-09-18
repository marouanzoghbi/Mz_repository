import type { ComparisonOperator, ConditionLogic } from "@prisma/client";
import type { DeviceState } from "../integrations/types.js";

/** Pure evaluation logic — no I/O — so it's easy to unit test independently
 * of Prisma or the provider clients. */

export function compareValue(
  actual: DeviceState[string] | undefined,
  operator: ComparisonOperator,
  expected: string,
): boolean {
  if (actual === undefined) return false;

  if (operator === "EQ" || operator === "NEQ") {
    const equal = String(actual).toLowerCase() === expected.toLowerCase();
    return operator === "EQ" ? equal : !equal;
  }

  const actualNum = Number(actual);
  const expectedNum = Number(expected);
  if (Number.isNaN(actualNum) || Number.isNaN(expectedNum)) return false;

  switch (operator) {
    case "GT":
      return actualNum > expectedNum;
    case "GTE":
      return actualNum >= expectedNum;
    case "LT":
      return actualNum < expectedNum;
    case "LTE":
      return actualNum <= expectedNum;
  }
}

export interface EvaluableCondition {
  metric: string;
  operator: ComparisonOperator;
  value: string;
  deviceState: DeviceState;
}

export function evaluateConditions(conditions: EvaluableCondition[], logic: ConditionLogic): boolean {
  if (conditions.length === 0) return false;
  const results = conditions.map((c) => compareValue(c.deviceState[c.metric], c.operator, c.value));
  return logic === "AND" ? results.every(Boolean) : results.some(Boolean);
}
