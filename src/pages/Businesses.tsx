import { Building2, Filter, Plus, Search, Store, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useResource } from "../lib/hooks";
import type { Business, Invitation } from "../types";
import { Empty, ErrorBox, Loading, PageHeader, Status, Toast } from "../components/ui";

const allModules = ["pos", "tables", "kds", "inventory", "cash", "delivery", "reservations", "whatsapp"];

export function BusinessesPage() {
  const resource = useResource(() => api<Business[]>("/admin/businesses"));
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const [form, setForm] = useState({ name: "", slug: "", plan: "basic", owner_email: "", modules: ["pos", "tables", "kds", "inventory", "cash"] });

  async function create(event: FormEvent) {
    event.preventDefault();
    try {
      const business = await api<Business>("/admin/businesses", { method: "POST", body: JSON.stringify({ name: form.name, slug: form.slug, plan: form.plan, modules: form.modules }) });
      let message = "Negocio creado correctamente.";
      if (form.owner_email) {
        try {
          const invitation = await api<Invitation>("/admin/invitations", { method: "POST", body: JSON.stringify({ business_id: business.id, email: form.owner_email, role: "owner" }) });
          message = invitation.delivery_status === "sent"
            ? "Negocio creado e invitación enviada."
            : "Negocio creado. La invitación quedó registrada, pero el correo no está configurado todavía.";
        } catch {
          message = "Negocio creado, pero no se pudo registrar la invitación del propietario.";
        }
      }
      setCreating(false); setForm({ name: "", slug: "", plan: "basic", owner_email: "", modules: ["pos", "tables", "kds", "inventory", "cash"] });
      setToast({ message, tone: "success" });
      await resource.refresh();
    } catch (caught) { setToast({ message: caught instanceof Error ? caught.message : "No se pudo crear.", tone: "error" }); }
  }
  const businesses = (resource.data || []).filter((item) => (status === "all" || item.status === status) && `${item.name} ${item.slug}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="page-stack"><PageHeader eyebrow="Tenants" title="Negocios y planes" description="Cada restaurante conserva sus datos, usuarios y módulos en un ámbito independiente." actions={<button className="button primary" onClick={() => setCreating(true)}><Plus /> Nuevo negocio</button>} />
    <section className="filter-bar"><label><Search /><input placeholder="Buscar negocio o slug" value={search} onChange={(event) => setSearch(event.target.value)} /></label><label><Filter /><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Todos los estados</option><option value="active">Activos</option><option value="suspended">Suspendidos</option></select></label></section>
    {resource.loading && !resource.data ? <Loading /> : resource.error && !resource.data ? <ErrorBox message={resource.error} retry={() => void resource.refresh()} /> : businesses.length ? <section className="business-cards">{businesses.map((business) => <Link to={`/negocios/${business.id}`} key={business.id}><div className="business-card-top"><span>{business.logo_url ? <img src={business.logo_url} alt="" /> : <Store />}</span><Status value={business.status} /></div><h2>{business.name}</h2><p>{business.slug}</p><div className="plan-line"><strong>{business.plan}</strong><small>{Object.values(business.modules).filter(Boolean).length} módulos activos</small></div><div className="module-dots">{Object.entries(business.modules).map(([module, enabled]) => <span key={module} className={enabled ? "on" : ""} title={module} />)}</div></Link>)}</section> : <Empty title="Sin resultados" detail="Ajusta los filtros o crea un nuevo negocio." />}
    {creating && <div className="modal-backdrop"><section className="modal"><header><div><span className="eyebrow">Alta segura</span><h2>Nuevo negocio</h2></div><button onClick={() => setCreating(false)}><X /></button></header><form className="form-stack" onSubmit={create}><label>Nombre<input value={form.name} onChange={(event) => { const name = event.target.value; setForm({ ...form, name, slug: form.slug || name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") }); }} required /></label><label>Slug público<input value={form.slug} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" onChange={(event) => setForm({ ...form, slug: event.target.value })} required /></label><div className="form-grid"><label>Plan<select value={form.plan} onChange={(event) => setForm({ ...form, plan: event.target.value })}><option value="basic">Básico</option><option value="pro">Pro</option><option value="superpro">SuperPRO</option></select></label><label>Correo del propietario<input type="email" value={form.owner_email} onChange={(event) => setForm({ ...form, owner_email: event.target.value })} placeholder="Invitación opcional" /></label></div><fieldset><legend>Módulos iniciales</legend><div className="module-checks">{allModules.map((module) => <label key={module}><input type="checkbox" checked={form.modules.includes(module)} onChange={(event) => setForm({ ...form, modules: event.target.checked ? [...form.modules, module] : form.modules.filter((item) => item !== module) })} />{module}</label>)}</div></fieldset><button className="button primary large"><Building2 /> Crear negocio</button><small>El propietario recibirá un enlace; nunca se genera ni se muestra una contraseña temporal.</small></form></section></div>}
    {toast && <Toast {...toast} onClose={() => setToast(null)} />}
  </div>;
}
