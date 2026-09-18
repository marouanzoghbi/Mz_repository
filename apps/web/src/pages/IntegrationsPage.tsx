import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../api/client.js";
import type { IntegrationAccountSummary, Provider } from "../types/index.js";

export function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<IntegrationAccountSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyProvider, setBusyProvider] = useState<Provider | null>(null);
  const [deyeForm, setDeyeForm] = useState({ email: "", password: "", companyId: "" });

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<{ integrations: IntegrationAccountSummary[] }>("/integrations");
      setIntegrations(res.integrations);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load integrations");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const connected = (provider: Provider) => integrations.find((i) => i.provider === provider);

  async function connectEwelink() {
    try {
      const res = await api.get<{ url: string }>("/integrations/ewelink/authorize-url");
      window.location.href = res.url;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to start eWeLink connection");
    }
  }

  async function connectDeye(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusyProvider("DEYE");
    try {
      await api.post("/integrations/deye/connect", {
        email: deyeForm.email,
        password: deyeForm.password,
        companyId: deyeForm.companyId || undefined,
      });
      setDeyeForm({ email: "", password: "", companyId: "" });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to connect Deye Cloud account");
    } finally {
      setBusyProvider(null);
    }
  }

  async function disconnect(provider: Provider) {
    setBusyProvider(provider);
    try {
      await api.delete(`/integrations/${provider}`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to disconnect");
    } finally {
      setBusyProvider(null);
    }
  }

  async function sync(provider: Provider) {
    setBusyProvider(provider);
    try {
      const res = await api.post<{ synced: number }>(`/integrations/${provider}/sync`);
      setError(null);
      alert(`Synced ${res.synced} device(s) from ${provider}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to sync devices");
    } finally {
      setBusyProvider(null);
    }
  }

  const ewelink = connected("EWELINK");
  const deye = connected("DEYE");

  return (
    <div>
      <h1>Integrations</h1>
      <p className="muted">Connect your eWeLink and Deye Cloud accounts so their devices show up in one place.</p>
      {error && <div className="error-banner">{error}</div>}
      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="card-grid">
          <section className="card">
            <div className="card-header">
              <h2>eWeLink</h2>
              <span className={`badge ${ewelink ? "badge-on" : "badge-off"}`}>{ewelink ? "Connected" : "Not connected"}</span>
            </div>
            <p className="muted">OAuth-based connection to your Sonoff/eWeLink account.</p>
            {ewelink ? (
              <div className="button-row">
                <button onClick={() => sync("EWELINK")} disabled={busyProvider === "EWELINK"}>
                  Sync devices
                </button>
                <button className="danger" onClick={() => disconnect("EWELINK")} disabled={busyProvider === "EWELINK"}>
                  Disconnect
                </button>
              </div>
            ) : (
              <button className="primary" onClick={connectEwelink}>
                Connect eWeLink
              </button>
            )}
          </section>

          <section className="card">
            <div className="card-header">
              <h2>Deye Cloud</h2>
              <span className={`badge ${deye ? "badge-on" : "badge-off"}`}>{deye ? "Connected" : "Not connected"}</span>
            </div>
            <p className="muted">Sign in with your Deye Cloud account credentials.</p>
            {deye ? (
              <div className="button-row">
                <button onClick={() => sync("DEYE")} disabled={busyProvider === "DEYE"}>
                  Sync devices
                </button>
                <button className="danger" onClick={() => disconnect("DEYE")} disabled={busyProvider === "DEYE"}>
                  Disconnect
                </button>
              </div>
            ) : (
              <form onSubmit={connectDeye} className="inline-form">
                <input
                  type="email"
                  placeholder="Deye Cloud email"
                  required
                  value={deyeForm.email}
                  onChange={(e) => setDeyeForm({ ...deyeForm, email: e.target.value })}
                />
                <input
                  type="password"
                  placeholder="Password"
                  required
                  value={deyeForm.password}
                  onChange={(e) => setDeyeForm({ ...deyeForm, password: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="Company ID (optional)"
                  value={deyeForm.companyId}
                  onChange={(e) => setDeyeForm({ ...deyeForm, companyId: e.target.value })}
                />
                <button type="submit" className="primary" disabled={busyProvider === "DEYE"}>
                  Connect Deye Cloud
                </button>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
