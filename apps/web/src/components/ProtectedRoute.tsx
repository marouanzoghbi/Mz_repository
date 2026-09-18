import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import { Layout } from "./Layout.js";

export function ProtectedRoute() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Layout />;
}
