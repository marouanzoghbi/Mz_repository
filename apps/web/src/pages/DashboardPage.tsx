import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../api/client.js";
import type { AutomationRule, Device, IntegrationAccountSummary } from "../types/index.js";

export function DashboardPage() {
  const [integrations, setIntegrations] = useState<IntegrationAccountSummary[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [i, d, r] = await Promise.all([
          api.get<{ integrations: IntegrationAccountSummary[] }>("/integrations"),
          api.get<{ devices: Device[] }>("/devices"),
          api.get<{ rules: AutomationRule[] }>("/automations"),
        ]);
        setIntegrations(i.integrations);
        setDevices(d.devices);
        setRules(r.rules);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  if (loading) return <p>Loading...</p>;

  const enabledRules = rules.filter((r) => r.enabled).length;
  const recentLogs = rules
    .flatMap((r) => (r.runLogs ?? []).map((log) => ({ ...log, ruleName: r.name })))
    .sort((a, b) => new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime())
    .slice(0, 10);

  return (
    <div>
      <h1>Overview</h1>
      {error && <div className="error-banner">{error}</div>}

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-value">{integrations.length}/2</div>
          <div className="stat-label">Integrations connected</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{devices.length}</div>
          <div className="stat-label">Devices synced</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {enabledRules}/{rules.length}
          </div>
          <div className="stat-label">Automations enabled</div>
        </div>
      </div>

      {integrations.length < 2 && (
        <div className="card">
          <p>
            You haven't connected both accounts yet. <Link to="/integrations">Connect eWeLink and Deye Cloud</Link> to unlock
            cross-platform automations.
          </p>
        </div>
      )}

      <h2>Automation rules</h2>
      {rules.length === 0 ? (
        <p className="muted">
          No automations yet. <Link to="/automations/new">Create your first one</Link>.
        </p>
      ) : (
        <ul className="plain-list">
          {rules.map((r) => (
            <li key={r.id}>
              <span className={`badge ${r.enabled ? "badge-on" : "badge-off"}`}>{r.enabled ? "on" : "off"}</span> {r.name} —{" "}
              {r.conditions.length} condition(s), {r.actions.length} action(s)
            </li>
          ))}
        </ul>
      )}

      {recentLogs.length > 0 && (
        <>
          <h2>Recent activity</h2>
          <ul className="plain-list">
            {recentLogs.map((log) => (
              <li key={log.id}>
                <span className={`badge status-${log.status.toLowerCase()}`}>{log.status}</span> {log.ruleName} —{" "}
                {new Date(log.triggeredAt).toLocaleString()}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
