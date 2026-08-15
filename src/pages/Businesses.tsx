import { Building2, CheckCircle2, Copy, Eye, EyeOff, Filter, KeyRound, Plus, RefreshCw, Search, Store, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import {
  buildN8nEnvironment,
  buildN8nPackage,
  buildRestaurantAccessPackage,
  generateSecurePassword,
  slugifyName,
} from "../lib/onboarding";
import { useResource } from "../lib/hooks";
import type { Business, RestaurantOnboardingResult } from "../types";
import { Empty, ErrorBox, Loading, PageHeader, Status, Toast } from "../components/ui";

const allModules = ["pos", "tables", "kds", "inventory", "cash", "delivery", "reservations", "whatsapp"];
const CLIENT_POS_URL = import.meta.env.VITE_CLIENT_POS_URL
  || (import.meta.env.DEV ? "http://localhost:5173" : "https://panelclientes-k8wt.vercel.app");

const initialForm = {
  name: "",
  slug: "",
  plan: "basic",
  owner_name: "",
  owner_email: "",
  owner_password: "",
  modules: [...allModules],
  branch_name: "Sucursal principal",
  branch_slug: "principal",
  branch_address: "",
  branch_phone: "",
};

const endpointLabels: Record<string, string> = {
  restaurant_context: "Datos del restaurante",
  yape_qr: "QR de Yape",
  menu: "Carta y disponibilidad",
  inventory: "Inventario",
  adjust_inventory: "Actualizar inventario",
  tables: "Mesas disponibles",
  reservation_availability: "Disponibilidad para reservas",
  create_order_draft: "Crear pedido",
  update_order: "Modificar pedido",
  confirm_order: "Confirmar pedido",
  confirm_cash_order: "Confirmar pedido en efectivo",
  payment_evidence: "Registrar comprobante",
  order_status: "Estado del pedido",
  request_human: "Solicitar atención humana",
  create_reservation: "Crear reserva",
  events: "Eventos pendientes",
  ack_event: "Confirmar evento procesado",
};

export function BusinessesPage() {
  const resource = useResource(() => api<Business[]>("/admin/businesses"));
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [onboarding, setOnboarding] = useState<RestaurantOnboardingResult | null>(null);
  const [ownerCredentials, setOwnerCredentials] = useState<{ username: string; password: string } | null>(null);
  const [showOwnerPassword, setShowOwnerPassword] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const [form, setForm] = useState(initialForm);

  async function create(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const result = await api<RestaurantOnboardingResult>("/admin/onboarding/restaurants", {
        method: "POST",
        body: JSON.stringify({
          business: {
            name: form.name.trim(),
            slug: form.slug,
            plan: form.plan,
            modules: form.modules,
          },
          branch: {
            name: form.branch_name.trim(),
            slug: form.branch_slug,
            address: form.branch_address.trim() || null,
            phone: form.branch_phone.trim() || null,
          },
          owner_name: form.owner_name.trim(),
          owner_email: form.owner_email.trim().toLowerCase(),
          owner_password: form.owner_password,
          credential_name: `Agente n8n - ${form.branch_name.trim()}`,
        }),
      });
      setOwnerCredentials({
        username: form.owner_email.trim().toLowerCase(),
        password: form.owner_password,
      });
      setCreating(false);
      setForm(initialForm);
      setOnboarding(result);
      setToast({
        message: "Restaurante, acceso al POS y APIs creados correctamente.",
        tone: "success",
      });
      await resource.refresh();
    } catch (caught) {
      setToast({ message: caught instanceof Error ? caught.message : "No se pudo crear el restaurante.", tone: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  async function copy(value: string, message: string) {
    await navigator.clipboard.writeText(value);
    setToast({ message, tone: "success" });
  }

  function closeOnboarding() {
    if (!window.confirm("La contraseña y el token secreto no podrán volver a consultarse. ¿Confirmas que ya guardaste ambos accesos?")) return;
    setOnboarding(null);
    setOwnerCredentials(null);
  }

  function startCreating() {
    setForm({ ...initialForm, modules: [...allModules], owner_password: generateSecurePassword() });
    setShowOwnerPassword(false);
    setCreating(true);
  }

  const businesses = (resource.data || []).filter(
    (item) => (status === "all" || item.status === status)
      && `${item.name} ${item.slug}`.toLowerCase().includes(search.toLowerCase()),
  );

  return <div className="page-stack">
    <PageHeader
      eyebrow="Tenants"
      title="Negocios y planes"
      description="Una sola alta prepara el POS, el acceso del propietario y todas las APIs privadas para su agente de n8n."
      actions={<button className="button primary" onClick={startCreating}><Plus /> Nuevo restaurante</button>}
    />
    <section className="filter-bar">
      <label><Search /><input placeholder="Buscar negocio o slug" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      <label><Filter /><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Todos los estados</option><option value="active">Activos</option><option value="suspended">Suspendidos</option></select></label>
    </section>
    {resource.loading && !resource.data
      ? <Loading />
      : resource.error && !resource.data
        ? <ErrorBox message={resource.error} retry={() => void resource.refresh()} />
        : businesses.length
          ? <section className="business-cards">{businesses.map((business) => <Link to={`/negocios/${business.id}`} key={business.id}><div className="business-card-top"><span>{business.logo_url ? <img src={business.logo_url} alt="" /> : <Store />}</span><Status value={business.status} /></div><h2>{business.name}</h2><p>{business.slug}</p><div className="plan-line"><strong>{business.plan}</strong><small>{Object.values(business.modules).filter(Boolean).length} módulos activos</small></div><div className="module-dots">{Object.entries(business.modules).map(([module, enabled]) => <span key={module} className={enabled ? "on" : ""} title={module} />)}</div></Link>)}</section>
          : <Empty title="Sin resultados" detail="Ajusta los filtros o crea un nuevo restaurante." />}

    {creating && <div className="modal-backdrop"><section className="modal onboarding-modal">
      <header><div><span className="eyebrow">Alta completa</span><h2>Nuevo restaurante</h2><p>Crearemos el negocio, su sede principal, el acceso del propietario y la conexión del agente.</p></div><button aria-label="Cerrar" onClick={() => setCreating(false)}><X /></button></header>
      <form className="form-stack" onSubmit={create}>
        <fieldset><legend>1. Negocio</legend><div className="form-grid">
          <label>Nombre<input value={form.name} onChange={(event) => { const name = event.target.value; const syncSlug = !form.slug || form.slug === slugifyName(form.name); setForm({ ...form, name, slug: syncSlug ? slugifyName(name) : form.slug }); }} required /></label>
          <label>Slug público<input value={form.slug} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" onChange={(event) => setForm({ ...form, slug: event.target.value })} required /></label>
          <label>Plan<select value={form.plan} onChange={(event) => setForm({ ...form, plan: event.target.value })}><option value="basic">Básico</option><option value="pro">Pro</option><option value="superpro">SuperPRO</option></select></label>
        </div></fieldset>
        <fieldset><legend>2. Usuario y contraseña</legend><div className="form-grid">
          <label>Nombre del propietario<input value={form.owner_name} onChange={(event) => setForm({ ...form, owner_name: event.target.value })} placeholder="Nombre de la persona responsable" required /></label>
          <label>Usuario (correo)<input type="email" value={form.owner_email} onChange={(event) => setForm({ ...form, owner_email: event.target.value })} placeholder="propietario@restaurante.pe" autoComplete="off" required /></label>
          <label className="owner-password-field">Contraseña<div className="password-input-row"><input type={showOwnerPassword ? "text" : "password"} value={form.owner_password} minLength={12} onChange={(event) => setForm({ ...form, owner_password: event.target.value })} autoComplete="new-password" required /><button type="button" title={showOwnerPassword ? "Ocultar contraseña" : "Mostrar contraseña"} onClick={() => setShowOwnerPassword((value) => !value)}>{showOwnerPassword ? <EyeOff /> : <Eye />}</button><button type="button" title="Generar otra contraseña" onClick={() => setForm({ ...form, owner_password: generateSecurePassword() })}><RefreshCw /></button></div><small>Mínimo 12 caracteres con mayúscula, minúscula, número y símbolo.</small></label>
        </div></fieldset>
        <fieldset><legend>3. Sucursal principal</legend><div className="form-grid">
          <label>Nombre de la sede<input value={form.branch_name} onChange={(event) => { const name = event.target.value; const syncSlug = !form.branch_slug || form.branch_slug === slugifyName(form.branch_name); setForm({ ...form, branch_name: name, branch_slug: syncSlug ? slugifyName(name) : form.branch_slug }); }} required /></label>
          <label>Slug de la sede<input value={form.branch_slug} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" onChange={(event) => setForm({ ...form, branch_slug: event.target.value })} required /></label>
          <label>Dirección<input value={form.branch_address} onChange={(event) => setForm({ ...form, branch_address: event.target.value })} /></label>
          <label>Teléfono del local<input value={form.branch_phone} onChange={(event) => setForm({ ...form, branch_phone: event.target.value })} /></label>
        </div></fieldset>
        <fieldset><legend>4. Módulos iniciales</legend><div className="module-checks">{allModules.map((module) => <label key={module}><input type="checkbox" checked={form.modules.includes(module)} onChange={(event) => setForm({ ...form, modules: event.target.checked ? [...form.modules, module] : form.modules.filter((item) => item !== module) })} />{module}</label>)}</div></fieldset>
        <button className="button primary large" disabled={submitting}><Building2 /> {submitting ? "Preparando restaurante..." : "Crear restaurante y APIs"}</button>
        <small>La contraseña viaja cifrada por HTTPS a Supabase Auth y no se guarda en la base del POS. El acceso y el token del agente se mostrarán una sola vez.</small>
      </form>
    </section></div>}

    {onboarding && <div className="modal-backdrop"><section className="modal onboarding-result-modal">
      <header><div><span className="eyebrow"><CheckCircle2 /> Alta completada</span><h2>{onboarding.business.name} está listo</h2><p>Guarda este paquete antes de cerrar. Corresponde únicamente a {onboarding.branch.name}.</p></div><button aria-label="Cerrar" onClick={closeOnboarding}><X /></button></header>
      <div className="onboarding-summary">
        <article><small>Negocio</small><strong>{onboarding.business.name}</strong><code>business_id: {onboarding.business.id}</code></article>
        <article><small>Sucursal</small><strong>{onboarding.branch.name}</strong><code>branch_id: {onboarding.branch.id}</code></article>
        <article><small>Acceso propietario</small><strong>{onboarding.owner_access.email}</strong><span>Usuario activo</span></article>
      </div>
      {ownerCredentials && <section className="pos-access-package">
        <header><div><KeyRound /><span><strong>Usuario y contraseña de CLIENTES</strong><small>Entrega estos datos al restaurante. Se muestran solo durante esta alta.</small></span></div><button className="button primary" onClick={() => void copy(buildRestaurantAccessPackage(CLIENT_POS_URL, ownerCredentials.username, ownerCredentials.password), "Usuario y contraseña copiados.")}><Copy /> Copiar acceso</button></header>
        <div className="access-credentials-grid">
          <article><small>URL del POS</small><code>{CLIENT_POS_URL}</code><button onClick={() => void copy(CLIENT_POS_URL, "URL de CLIENTES copiada.")}><Copy /></button></article>
          <article><small>Usuario</small><code>{ownerCredentials.username}</code><button onClick={() => void copy(ownerCredentials.username, "Usuario copiado.")}><Copy /></button></article>
          <article><small>Contraseña</small><code>{ownerCredentials.password}</code><button onClick={() => void copy(ownerCredentials.password, "Contraseña copiada.")}><Copy /></button></article>
        </div>
      </section>}
      <section className="secret-once">
        <div><KeyRound /><span><strong>Token secreto de un solo uso</strong><small>Úsalo como credencial Bearer del workflow de este restaurante.</small></span></div>
        <code>{onboarding.credential.token}</code>
        <button className="button secondary" onClick={() => void copy(onboarding.credential.token, "Token copiado para n8n.")}><Copy /> Copiar token</button>
      </section>
      <section className="n8n-copy-block">
        <header><div><h3>Variables para n8n</h3><p>Se pueden guardar como credenciales o variables del workflow.</p></div><div><button className="button secondary" onClick={() => void copy(buildN8nEnvironment(onboarding), "Variables copiadas para n8n.")}><Copy /> Copiar variables</button><button className="button primary" onClick={() => void copy(buildN8nPackage(onboarding), "Paquete completo de APIs copiado.")}><Copy /> Copiar paquete completo</button></div></header>
        <pre>{buildN8nEnvironment(onboarding)}</pre>
      </section>
      <section className="endpoint-package">
        <header><div><h3>APIs exclusivas del agente</h3><p>Estas rutas ya quedan autorizadas para este restaurante y esta sucursal.</p></div><span>{Object.keys(onboarding.n8n.endpoints).length} endpoints</span></header>
        <div>{Object.entries(onboarding.n8n.endpoints).map(([key, endpoint]) => <article key={key}><span className={`http-method method-${endpoint.method.toLowerCase()}`}>{endpoint.method}</span><div><strong>{endpointLabels[key] || key}</strong><code>{endpoint.url}</code></div><button title="Copiar endpoint" onClick={() => void copy(endpoint.url, `${endpointLabels[key] || key}: endpoint copiado.`)}><Copy /></button></article>)}</div>
      </section>
      <button className="button primary large" onClick={closeOnboarding}>Ya guardé el acceso y las APIs, cerrar</button>
    </section></div>}

    {toast && <Toast {...toast} onClose={() => setToast(null)} />}
  </div>;
}
