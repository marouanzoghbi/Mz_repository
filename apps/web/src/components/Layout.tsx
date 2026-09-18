import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";

export function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">Energy Dashboard</div>
        <nav>
          <NavLink to="/" end>
            Overview
          </NavLink>
          <NavLink to="/integrations">Integrations</NavLink>
          <NavLink to="/devices">Devices</NavLink>
          <NavLink to="/automations">Automations</NavLink>
        </nav>
        <div className="sidebar-footer">
          <span>{user?.email}</span>
          <button className="link-button" onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
