import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client.js";
import type { Device, Provider } from "../types/index.js";

export function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [filter, setFilter] = useState<Provider | "ALL">("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const query = filter === "ALL" ? "" : `?provider=${filter}`;
      const res = await api.get<{ devices: Device[] }>(`/devices${query}`);
      setDevices(res.devices);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load devices");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function refresh(deviceId: string) {
    setRefreshingId(deviceId);
    try {
      const res = await api.post<{ device: Device }>(`/devices/${deviceId}/refresh`);
      setDevices((prev) => prev.map((d) => (d.id === deviceId ? res.device : d)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to refresh device");
    } finally {
      setRefreshingId(null);
    }
  }

  return (
    <div>
      <h1>Devices</h1>
      <p className="muted">Cached device inventory synced from your connected accounts.</p>

      <div className="button-row">
        {(["ALL", "EWELINK", "DEYE"] as const).map((p) => (
          <button key={p} className={filter === p ? "active" : ""} onClick={() => setFilter(p)}>
            {p}
          </button>
        ))}
      </div>

      {error && <div className="error-banner">{error}</div>}
      {loading ? (
        <p>Loading...</p>
      ) : devices.length === 0 ? (
        <p className="muted">No devices yet. Connect an integration and hit "Sync devices" first.</p>
      ) : (
        <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Provider</th>
              <th>Type</th>
              <th>State</th>
              <th>Last synced</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {devices.map((device) => (
              <tr key={device.id}>
                <td>{device.name}</td>
                <td>
                  <span className={`badge ${device.provider === "EWELINK" ? "badge-ewelink" : "badge-deye"}`}>{device.provider}</span>
                </td>
                <td>{device.deviceType}</td>
                <td className="state-cell">
                  {Object.entries(device.lastState).length === 0
                    ? <span className="muted">—</span>
                    : Object.entries(device.lastState).map(([k, v]) => (
                        <span className="state-pill" key={k}>
                          {k}: {String(v)}
                        </span>
                      ))}
                </td>
                <td className="muted">{device.lastSyncedAt ? new Date(device.lastSyncedAt).toLocaleString() : "never"}</td>
                <td>
                  <button onClick={() => refresh(device.id)} disabled={refreshingId === device.id}>
                    {refreshingId === device.id ? "..." : "Refresh"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}
