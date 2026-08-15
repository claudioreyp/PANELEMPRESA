import { Navigate, Route, Routes } from "react-router-dom";
import { Shell } from "./components/Shell";
import { Loading } from "./components/ui";
import { useAuth } from "./lib/auth";
import { AuditPage } from "./pages/Audit";
import { BusinessDetailPage } from "./pages/BusinessDetail";
import { BusinessesPage } from "./pages/Businesses";
import { DashboardPage } from "./pages/Dashboard";
import { InvitationsPage } from "./pages/Invitations";
import { LoginPage } from "./pages/Login";

function ProtectedRoutes() {
  return <Shell><Routes><Route path="/" element={<DashboardPage />} /><Route path="/negocios" element={<BusinessesPage />} /><Route path="/negocios/:id" element={<BusinessDetailPage />} /><Route path="/invitaciones" element={<InvitationsPage />} /><Route path="/auditoria" element={<AuditPage />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes></Shell>;
}

export function App() {
  const { user, identity, loading } = useAuth();
  if (loading) return <Loading label="Validando permisos globales..." />;
  return <Routes><Route path="/login" element={user && identity ? <Navigate to="/" replace /> : <LoginPage />} /><Route path="/*" element={user && identity ? <ProtectedRoutes /> : <Navigate to="/login" replace />} /></Routes>;
}
