import { ArrowLeft, Building2, Check, GitBranch, MailPlus, Save, ShieldCheck, Store, UserRoundCog } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { useResource } from "../lib/hooks";
import type { Branch, Business, BusinessOverview, Invitation, Membership } from "../types";
import { Empty, ErrorBox, Loading, Money, PageHeader, Status, Toast } from "../components/ui";
import { IntegrationPanel } from "../components/IntegrationPanel";
import { PasswordResetDialog } from "../components/PasswordResetDialog";

const modules = ["pos", "tables", "kds", "inventory", "cash", "delivery", "reservations", "whatsapp"];
const roles = ["owner", "manager", "cashier", "waiter", "kitchen", "dispatcher"];

export function BusinessDetailPage() {
  const businessId = Number(useParams().id);
  const resource = useResource(async () => {
    const [overview, branches, invitations, memberships] = await Promise.all([
      api<BusinessOverview>(`/admin/businesses/${businessId}/overview`),
      api<Branch[]>(`/branches?business_id=${businessId}`),
      api<Invitation[]>(`/admin/invitations?business_id=${businessId}`),
      api<Membership[]>(`/admin/businesses/${businessId}/memberships`),
    ]);
    return { overview, branches, invitations, memberships };
  }, [businessId]);
  const [businessForm, setBusinessForm] = useState<Business | null>(null);
  const [passwordMember, setPasswordMember] = useState<Membership | null>(null);
  const [branchForm, setBranchForm] = useState({ name: "", slug: "", address: "", phone: "" });
  const [inviteForm, setInviteForm] = useState({ email: "", role: "manager", branch_id: "" });
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);

  useEffect(() => { if (resource.data?.overview.business) setBusinessForm(resource.data.overview.business); }, [resource.data?.overview.business]);
  useEffect(() => { setPasswordMember(null); }, [businessId]);

  async function saveBusiness() {
    if (!businessForm) return;
    try {
      const updated = await api<Business>(`/admin/businesses/${businessId}`, { method: "PATCH", body: JSON.stringify({ name: businessForm.name, status: businessForm.status, phone: businessForm.phone }) });
      setBusinessForm(updated); setToast({ message: "Configuración actualizada y auditada.", tone: "success" }); await resource.refresh();
    } catch (caught) { setToast({ message: caught instanceof Error ? caught.message : "No se pudo guardar.", tone: "error" }); }
  }

  async function createBranch(event: FormEvent) {
    event.preventDefault();
    try {
      await api(`/branches?business_id=${businessId}`, { method: "POST", body: JSON.stringify({ ...branchForm, opening_hours: {}, accepted_payment_methods: ["cash", "card", "yape", "plin"], delivery_enabled: true, takeaway_enabled: true, delivery_fee: 0 }) });
      setBranchForm({ name: "", slug: "", address: "", phone: "" }); setToast({ message: "Sucursal creada con salón y caja principal.", tone: "success" }); await resource.refresh();
    } catch (caught) { setToast({ message: caught instanceof Error ? caught.message : "No se pudo crear la sucursal.", tone: "error" }); }
  }

  async function invite(event: FormEvent) {
    event.preventDefault();
    try {
      const result = await api<Invitation>("/admin/invitations", { method: "POST", body: JSON.stringify({ business_id: businessId, email: inviteForm.email, role: inviteForm.role, branch_id: inviteForm.branch_id ? Number(inviteForm.branch_id) : null }) });
      setInviteForm({ email: "", role: "manager", branch_id: "" });
      const delivery = result.delivery_status === "sent" ? "Invitación enviada por correo." : result.development_accept_url ? "Invitación creada; enlace local disponible en la lista." : "Invitación creada, pero revisa la configuración de correo.";
      setToast({ message: delivery, tone: result.delivery_status === "failed" ? "error" : "success" }); await resource.refresh();
    } catch (caught) { setToast({ message: caught instanceof Error ? caught.message : "No se pudo invitar.", tone: "error" }); }
  }

  async function updateMembership(member: Membership, changes: Partial<Pick<Membership, "role" | "active">>) {
    try { await api(`/admin/memberships/${member.id}`, { method: "PATCH", body: JSON.stringify(changes) }); setToast({ message: "Acceso del usuario actualizado.", tone: "success" }); await resource.refresh(); }
    catch (caught) { setToast({ message: caught instanceof Error ? caught.message : "No se pudo actualizar el acceso.", tone: "error" }); }
  }

  if (resource.loading && !resource.data) return <Loading label="Abriendo el negocio..." />;
  if (resource.error && !resource.data) return <ErrorBox message={resource.error} retry={() => void resource.refresh()} />;
  if (!resource.data || !businessForm) return null;
  const { overview, branches, invitations, memberships } = resource.data;
  return <div className="page-stack detail-page">
    <Link className="back-link" to="/negocios"><ArrowLeft /> Volver a negocios</Link>
    <PageHeader eyebrow={`Tenant #${businessId}`} title={businessForm.name} description={`${businessForm.slug} · ${businessForm.timezone} · ${businessForm.currency}`} actions={<><Status value={businessForm.status} /><button className="button primary" onClick={() => void saveBusiness()}><Save /> Guardar cambios</button></>} />
    <section className="overview-strip"><article><Store /><span>Acceso<strong>POS completo</strong></span></article><article><GitBranch /><span>Sucursales<strong>{overview.branches}</strong></span></article><article><UserRoundCog /><span>Usuarios activos<strong>{overview.users}</strong></span></article><article><Building2 /><span>Pedidos históricos<strong>{overview.orders}</strong></span></article><article><ShieldCheck /><span>Ventas cerradas<strong><Money value={overview.sales} /></strong></span></article></section>
    <section className="detail-grid">
      <article className="panel config-card"><header><div><span className="eyebrow">Cuenta</span><h2>Cuenta y operación</h2></div><ShieldCheck /></header><div className="form-grid"><label>Nombre<input value={businessForm.name} onChange={(event) => setBusinessForm({ ...businessForm, name: event.target.value })} /></label><label>Teléfono<input value={businessForm.phone || ""} onChange={(event) => setBusinessForm({ ...businessForm, phone: event.target.value })} /></label><label>Acceso<input value="POS completo" readOnly /></label><label>Estado<select value={businessForm.status} onChange={(event) => setBusinessForm({ ...businessForm, status: event.target.value as Business["status"] })}><option value="active">Activo</option><option value="suspended">Suspendido</option></select></label></div><div className="evidence-settings"><strong>Aprobación humana obligatoria</strong><small>El agente puede registrar una captura real y sus datos, pero solo un supervisor puede aprobar el pago y enviar el pedido a preparación.</small></div></article>
      <article className="panel module-card"><header><div><span className="eyebrow">Incluido</span><h2>POS completo</h2></div><Check /></header><div className="module-toggle-list">{modules.map((module) => <label key={module}><span><strong>{module.toUpperCase()}</strong><small>{module === "whatsapp" ? "Preparado para la futura capa de IA" : "Visible para el equipo del restaurante"}</small></span><Check aria-label="Incluido" /></label>)}</div></article>
    </section>
    <section className="detail-grid">
      <article className="panel"><header><div><span className="eyebrow">Sedes</span><h2>Sucursales</h2></div><GitBranch /></header><div className="branch-list">{branches.map((branch) => <div key={branch.id}><span>{branch.name.slice(0, 1)}</span><p><strong>{branch.name}</strong><small>{branch.address || "Dirección pendiente"} · {branch.active ? "Operativa" : "Inactiva"}</small></p><Status value={branch.active ? "active" : "suspended"} /></div>)}</div><form className="compact-form" onSubmit={createBranch}><h3>Nueva sucursal</h3><div className="form-grid"><label>Nombre<input value={branchForm.name} onChange={(event) => { const name = event.target.value; setBranchForm({ ...branchForm, name, slug: branchForm.slug || name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") }); }} required /></label><label>Slug<input value={branchForm.slug} onChange={(event) => setBranchForm({ ...branchForm, slug: event.target.value })} required /></label><label>Dirección<input value={branchForm.address} onChange={(event) => setBranchForm({ ...branchForm, address: event.target.value })} /></label><label>Teléfono<input value={branchForm.phone} onChange={(event) => setBranchForm({ ...branchForm, phone: event.target.value })} /></label></div><button className="button secondary"><GitBranch /> Crear sucursal</button></form></article>
      <article className="panel"><header><div><span className="eyebrow">Onboarding</span><h2>Invitar al equipo</h2></div><MailPlus /></header><form className="form-stack" onSubmit={invite}><label>Correo<input type="email" value={inviteForm.email} onChange={(event) => setInviteForm({ ...inviteForm, email: event.target.value })} required /></label><div className="form-grid"><label>Rol<select value={inviteForm.role} onChange={(event) => setInviteForm({ ...inviteForm, role: event.target.value })}>{roles.map((role) => <option key={role}>{role}</option>)}</select></label><label>Ámbito<select value={inviteForm.branch_id} onChange={(event) => setInviteForm({ ...inviteForm, branch_id: event.target.value })}><option value="">Todo el negocio</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label></div><button className="button primary"><MailPlus /> Enviar invitación</button><small>El enlace vence en 7 días y se almacena únicamente como hash.</small></form><div className="mini-invitations">{invitations.slice(0, 5).map((item) => <div key={item.id}><span>{item.email.slice(0, 1).toUpperCase()}</span><p><strong>{item.email}</strong><small>{item.role} · vence {new Date(item.expires_at).toLocaleDateString("es-PE")}</small></p><Status value={item.status} /></div>)}</div></article>
    </section>
    <IntegrationPanel branches={branches} />
    <section className="panel"><header><div><span className="eyebrow">Accesos</span><h2>Propietarios y empleados</h2></div><UserRoundCog /></header>{memberships.length ? <div className="responsive-table"><table><thead><tr><th>Usuario</th><th>Sucursal</th><th>Rol</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{memberships.map((member) => <tr key={member.id}><td><strong>{member.full_name}</strong><small>{member.email}</small></td><td>{branches.find((branch) => branch.id === member.branch_id)?.name || "Todo el negocio"}</td><td><select value={member.role} onChange={(event) => void updateMembership(member, { role: event.target.value })}>{roles.map((role) => <option key={role}>{role}</option>)}</select></td><td><Status value={member.active ? "active" : "suspended"} /></td><td><button className={member.active ? "text-danger" : "text-success"} onClick={() => void updateMembership(member, { active: !member.active })}>{member.active ? "Suspender" : "Reactivar"}</button>{member.can_reset_password && <button className="button secondary" onClick={() => setPasswordMember(member)}>{member.password_reset_operation_id ? "Consultar renovación" : "Renovar contraseña"}</button>}{member.password_reset_required && <small>Renovación requerida</small>}</td></tr>)}</tbody></table></div> : <Empty title="Sin usuarios activos" detail="Envía una invitación para incorporar al equipo." />}</section>
    {passwordMember && <PasswordResetDialog key={`${businessId}:${passwordMember.id}`} member={passwordMember} onClose={() => setPasswordMember(null)} onUpdated={() => void resource.refresh()} />}
    {toast && <Toast {...toast} onClose={() => setToast(null)} />}
  </div>;
}
