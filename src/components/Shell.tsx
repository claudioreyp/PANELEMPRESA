import { Activity, Building2, LayoutDashboard, LogOut, MailPlus, Menu, ShieldCheck, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../lib/auth";

const links = [
  { to: "/", label: "Resumen", icon: LayoutDashboard, end: true },
  { to: "/negocios", label: "Negocios", icon: Building2 },
  { to: "/invitaciones", label: "Invitaciones", icon: MailPlus },
  { to: "/auditoria", label: "Auditoría", icon: Activity },
];

export function Shell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { identity, signOut } = useAuth();
  return <div className="admin-shell">
    <aside className={open ? "admin-sidebar open" : "admin-sidebar"}>
      <div className="admin-brand"><span><ShieldCheck /></span><div><strong>Escalar AI</strong><small>Control central</small></div><button className="close-menu" onClick={() => setOpen(false)}><X /></button></div>
      <nav>{links.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)}><Icon />{label}</NavLink>)}</nav>
      <div className="admin-account"><div><span>{identity?.email?.slice(0, 1).toUpperCase() || "S"}</span><p><strong>{identity?.email || "Superadmin"}</strong><small>Acceso global auditado</small></p></div><button onClick={() => void signOut()}><LogOut /> Cerrar sesión</button></div>
    </aside>
    {open && <button className="menu-scrim" onClick={() => setOpen(false)} />}
    <section className="admin-workspace"><div className="mobile-bar"><button onClick={() => setOpen(true)}><Menu /></button><strong>Escalar AI Admin</strong></div><main>{children}</main></section>
  </div>;
}
