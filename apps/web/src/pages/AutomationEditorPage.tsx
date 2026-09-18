import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../api/client.js";
import type {
  AutomationActionInput,
  AutomationConditionInput,
  AutomationRule,
  ComparisonOperator,
  ConditionLogic,
  Device,
} from "../types/index.js";

const OPERATORS: ComparisonOperator[] = ["EQ", "NEQ", "GT", "GTE", "LT", "LTE"];

function emptyCondition(deviceId: string): AutomationConditionInput {
  return { deviceId, metric: "", operator: "GT", value: "" };
}

function emptyAction(deviceId: string): AutomationActionInput {
  return { deviceId, actionType: "", params: {} };
}

export function AutomationEditorPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [devices, setDevices] = useState<Device[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [conditionLogic, setConditionLogic] = useState<ConditionLogic>("AND");
  const [cooldownSeconds, setCooldownSeconds] = useState(300);
  const [conditions, setConditions] = useState<AutomationConditionInput[]>([]);
  const [actions, setActions] = useState<AutomationActionInput[]>([]);
  const [actionParamsText, setActionParamsText] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const devicesRes = await api.get<{ devices: Device[] }>("/devices");
        setDevices(devicesRes.devices);
        const firstDeviceId = devicesRes.devices[0]?.id ?? "";

        if (isEdit && id) {
          const res = await api.get<{ rule: AutomationRule }>(`/automations/${id}`);
          const rule = res.rule;
          setName(rule.name);
          setDescription(rule.description ?? "");
          setEnabled(rule.enabled);
          setConditionLogic(rule.conditionLogic);
          setCooldownSeconds(rule.cooldownSeconds);
          setConditions(rule.conditions.map((c) => ({ deviceId: c.deviceId, metric: c.metric, operator: c.operator, value: c.value })));
          setActions(rule.actions.map((a) => ({ deviceId: a.deviceId, actionType: a.actionType, params: a.params })));
          setActionParamsText(rule.actions.map((a) => JSON.stringify(a.params, null, 2)));
        } else {
          setConditions([emptyCondition(firstDeviceId)]);
          setActions([emptyAction(firstDeviceId)]);
          setActionParamsText(["{}"]);
        }
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Failed to load automation editor");
      } finally {
        setLoading(false);
      }
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function updateCondition(idx: number, patch: Partial<AutomationConditionInput>) {
    setConditions((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  }

  function updateAction(idx: number, patch: Partial<AutomationActionInput>) {
    setActions((prev) => prev.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
  }

  function updateActionParamsText(idx: number, text: string) {
    setActionParamsText((prev) => prev.map((t, i) => (i === idx ? text : t)));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    let parsedActions: AutomationActionInput[];
    try {
      parsedActions = actions.map((a, i) => ({ ...a, params: JSON.parse(actionParamsText[i] || "{}") }));
    } catch {
      setError("Action params must be valid JSON");
      return;
    }

    setSaving(true);
    try {
      const payload = { name, description: description || undefined, enabled, conditionLogic, cooldownSeconds, conditions, actions: parsedActions };
      if (isEdit && id) await api.put(`/automations/${id}`, payload);
      else await api.post("/automations", payload);
      navigate("/automations");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save automation");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>Loading...</p>;

  const defaultDeviceId = devices[0]?.id ?? "";

  return (
    <div>
      <h1>{isEdit ? "Edit automation" : "New automation"}</h1>
      {devices.length === 0 && <div className="error-banner">No devices found. Connect an integration and sync devices first.</div>}
      {error && <div className="error-banner">{error}</div>}

      <form onSubmit={onSubmit} className="rule-form">
        <label>
          Name
          <input required value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Description
          <input value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <div className="form-row">
          <label>
            Enabled
            <select value={enabled ? "yes" : "no"} onChange={(e) => setEnabled(e.target.value === "yes")}>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
          <label>
            Condition logic
            <select value={conditionLogic} onChange={(e) => setConditionLogic(e.target.value as ConditionLogic)}>
              <option value="AND">AND — all conditions must be true</option>
              <option value="OR">OR — any condition may be true</option>
            </select>
          </label>
          <label>
            Cooldown (seconds)
            <input
              type="number"
              min={0}
              value={cooldownSeconds}
              onChange={(e) => setCooldownSeconds(Number(e.target.value))}
            />
          </label>
        </div>

        <fieldset>
          <legend>Conditions</legend>
          {conditions.map((c, idx) => (
            <div className="condition-row" key={idx}>
              <select value={c.deviceId} onChange={(e) => updateCondition(idx, { deviceId: e.target.value })}>
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.provider})
                  </option>
                ))}
              </select>
              <input
                placeholder="metric, e.g. batterySoc"
                required
                value={c.metric}
                onChange={(e) => updateCondition(idx, { metric: e.target.value })}
              />
              <select value={c.operator} onChange={(e) => updateCondition(idx, { operator: e.target.value as ComparisonOperator })}>
                {OPERATORS.map((op) => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
              </select>
              <input
                placeholder="value, e.g. 20"
                required
                value={c.value}
                onChange={(e) => updateCondition(idx, { value: e.target.value })}
              />
              <button
                type="button"
                className="danger"
                onClick={() => setConditions((prev) => prev.filter((_, i) => i !== idx))}
              >
                Remove
              </button>
            </div>
          ))}
          <button type="button" onClick={() => setConditions((prev) => [...prev, emptyCondition(defaultDeviceId)])}>
            + Add condition
          </button>
        </fieldset>

        <fieldset>
          <legend>Actions</legend>
          {actions.map((a, idx) => (
            <div className="action-row" key={idx}>
              <div className="condition-row">
                <select value={a.deviceId} onChange={(e) => updateAction(idx, { deviceId: e.target.value })}>
                  {devices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.provider})
                    </option>
                  ))}
                </select>
                <input
                  placeholder="actionType, e.g. setSwitch"
                  required
                  value={a.actionType}
                  onChange={(e) => updateAction(idx, { actionType: e.target.value })}
                />
                <button
                  type="button"
                  className="danger"
                  onClick={() => {
                    setActions((prev) => prev.filter((_, i) => i !== idx));
                    setActionParamsText((prev) => prev.filter((_, i) => i !== idx));
                  }}
                >
                  Remove
                </button>
              </div>
              <textarea
                className="params-textarea"
                rows={3}
                value={actionParamsText[idx] ?? "{}"}
                onChange={(e) => updateActionParamsText(idx, e.target.value)}
                placeholder='params as JSON, e.g. { "switch": "off" }'
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              setActions((prev) => [...prev, emptyAction(defaultDeviceId)]);
              setActionParamsText((prev) => [...prev, "{}"]);
            }}
          >
            + Add action
          </button>
        </fieldset>

        <div className="button-row">
          <button type="submit" className="primary" disabled={saving || devices.length === 0}>
            {saving ? "Saving..." : "Save automation"}
          </button>
          <button type="button" onClick={() => navigate("/automations")}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
