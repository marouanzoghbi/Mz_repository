import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../api/client.js";
import type { AutomationRule } from "../types/index.js";

export function AutomationsPage() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<{ rules: AutomationRule[] }>("/automations");
      setRules(res.rules);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load automations");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function toggle(rule: AutomationRule) {
    setBusyId(rule.id);
    try {
      await api.patch(`/automations/${rule.id}/toggle`, { enabled: !rule.enabled });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update automation");
    } finally {
      setBusyId(null);
    }
  }

  async function runNow(rule: AutomationRule) {
    setBusyId(rule.id);
    try {
      const res = await api.post<{ ran: boolean; latestLog: { status: string } | null }>(`/automations/${rule.id}/run`);
      alert(res.latestLog ? `Rule ran — status: ${res.latestLog.status}` : "Conditions were not met, nothing ran.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to run automation");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(rule: AutomationRule) {
    if (!confirm(`Delete automation "${rule.name}"?`)) return;
    setBusyId(rule.id);
    try {
      await api.delete(`/automations/${rule.id}`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete automation");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Automations</h1>
        <Link to="/automations/new" className="primary button-link">
          + New automation
        </Link>
      </div>
      <p className="muted">Cross-platform rules: when device conditions are met, actions run on eWeLink and/or Deye devices.</p>

      {error && <div className="error-banner">{error}</div>}
      {loading ? (
        <p>Loading...</p>
      ) : rules.length === 0 ? (
        <p className="muted">No automations yet. Create one to get started.</p>
      ) : (
        <div className="rule-list">
          {rules.map((rule) => (
            <div className="card" key={rule.id}>
              <div className="card-header">
                <h2>{rule.name}</h2>
                <span className={`badge ${rule.enabled ? "badge-on" : "badge-off"}`}>{rule.enabled ? "Enabled" : "Disabled"}</span>
              </div>
              {rule.description && <p className="muted">{rule.description}</p>}
              <p className="muted">
                {rule.conditions.length} condition(s) ({rule.conditionLogic}) → {rule.actions.length} action(s) · cooldown{" "}
                {rule.cooldownSeconds}s
              </p>
              <p className="muted">
                Last triggered: {rule.lastTriggeredAt ? new Date(rule.lastTriggeredAt).toLocaleString() : "never"}
              </p>
              <div className="button-row">
                <button onClick={() => toggle(rule)} disabled={busyId === rule.id}>
                  {rule.enabled ? "Disable" : "Enable"}
                </button>
                <button onClick={() => runNow(rule)} disabled={busyId === rule.id}>
                  Run now
                </button>
                <Link to={`/automations/${rule.id}/edit`} className="button-link">
                  Edit
                </Link>
                <button className="danger" onClick={() => remove(rule)} disabled={busyId === rule.id}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
