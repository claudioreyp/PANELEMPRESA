import { Building2, CheckCircle2, Copy, Eye, EyeOff, Filter, KeyRound, Plus, RefreshCw, Search, Store, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { OnboardingDialog } from "../components/OnboardingDialog";
import { api, ApiError } from "../lib/api";
import {
  buildRestaurantAccessPackage,
  generateSecurePassword,
  slugifyName,
} from "../lib/onboarding";
import { useResource } from "../lib/hooks";
import type { Business, RestaurantOnboardingResult } from "../types";
import { IntegrationPackageView } from "../components/IntegrationPackageView";
import { Empty, ErrorBox, Loading, PageHeader, Status, Toast } from "../components/ui";


const CLIENT_POS_URL = import.meta.env.VITE_CLIENT_POS_URL
  || (import.meta.env.DEV ? "http://localhost:5173" : "https://panelclientes-k8wt.vercel.app");

const initialForm = {
  name: "",
  slug: "",
  owner_name: "",
  owner_email: "",
  owner_password: "",
  branch_name: "Sucursal principal",
  branch_slug: "principal",
  branch_address: "",
  branch_phone: "",
};

export function BusinessesPage() {
  const working = useRef(false);
  const [uncertainSlug, setUncertainSlug] = useState<string | null>(null);
  const [reconciledBusiness, setReconciledBusiness] = useState<Business | null>(null);
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

  useEffect(() => {
    if (!onboarding && !submitting && !uncertainSlug) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [onboarding, submitting, uncertainSlug]);

  async function reconcile() {
    if (!uncertainSlug || working.current) return;
    working.current = true;
    setSubmitting(true);
    try {
      const result = await api<{ status: string; business: Business | null }>(`/admin/onboarding/restaurants/status?slug=${encodeURIComponent(uncertainSlug)}`);
      setReconciledBusiness(result.business);
      setToast({ tone: "error", message: result.business
        ? "El negocio existe. Revísalo antes de continuar; el token perdido no se recupera ni se rota automáticamente."
        : "No hay un alta confirmada. Una solicitud anterior podría seguir en curso: revisa Auth y el registro de altas antes de repetirla." });
    } catch { setToast({ tone: "error", message: "No se pudo comprobar el alta. No se enviará otra creación." }); }
    finally { working.current = false; setSubmitting(false); }
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    if (working.current || uncertainSlug) return;
    working.current = true;
    setSubmitting(true);
    try {
      const result = await api<RestaurantOnboardingResult>("/admin/onboarding/restaurants", {
        method: "POST",
        body: JSON.stringify({
          business: {
            name: form.name.trim(),
            slug: form.slug,
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
          credential_name: `Integracion - ${form.branch_name.trim()}`,
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
      if (!(caught instanceof ApiError) || caught.status >= 500 || caught.status === 409) setUncertainSlug(form.slug);
      setToast({ message: caught instanceof Error ? caught.message : "No se pudo crear el restaurante.", tone: "error" });
    } finally {
      working.current = false;
      setSubmitting(false);
    }
  }

  async function copy(value: string, message: string) {
    try {
      await navigator.clipboard.writeText(value);
      setToast({ message, tone: "success" });
    } catch { setToast({ message: "No se pudo copiar. Selecciona y copia el dato manualmente.", tone: "error" }); }
  }

  function closeOnboarding() {
    if (!window.confirm("La contraseña y el token secreto no podrán volver a consultarse. ¿Confirmas que ya guardaste ambos accesos?")) return;
    setOnboarding(null);
    setOwnerCredentials(null);
  }

  function startCreating() {
    if (uncertainSlug) { setCreating(true); return; }
    setForm({ ...initialForm, owner_password: generateSecurePassword() });
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
      title="Negocios"
      description="Una sola alta prepara el POS completo, el acceso del propietario y las APIs privadas de su restaurante."
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
          ? <section className="business-cards">{businesses.map((business) => <Link to={`/negocios/${business.id}`} key={business.id}><div className="business-card-top"><span>{business.logo_url ? <img src={business.logo_url} alt="" /> : <Store />}</span><Status value={business.status} /></div><h2>{business.name}</h2><p>{business.slug}</p><div className="plan-line"><strong>POS completo</strong><small>{Object.values(business.modules).filter(Boolean).length} módulos activos</small></div><div className="module-dots">{Object.entries(business.modules).map(([module, enabled]) => <span key={module} className={enabled ? "on" : ""} title={module} />)}</div></Link>)}</section>
          : <Empty title="Sin resultados" detail="Ajusta los filtros o crea un nuevo restaurante." />}

    {creating && <OnboardingDialog className="onboarding-modal" label="Nuevo restaurante" onClose={() => { if (!working.current) setCreating(false); }}>
      <header><div><span className="eyebrow">Alta completa</span><h2>Nuevo restaurante</h2><p>Crearemos el negocio, su sede principal, el acceso del propietario y la conexión del agente.</p></div><button aria-label="Cerrar" disabled={submitting} onClick={() => setCreating(false)}><X /></button></header>
      <form className="form-stack" onSubmit={create}>
        {uncertainSlug && <div role="alert" className="form-error"><p>El resultado del alta no está confirmado. No vuelvas a crear el restaurante antes de revisar su estado.</p><button type="button" className="button secondary" disabled={submitting} onClick={() => void reconcile()}>Consultar estado del alta</button>{reconciledBusiness && <Link to={`/negocios/${reconciledBusiness.id}`}>Abrir restaurante existente</Link>}</div>}
        <fieldset disabled={submitting || Boolean(uncertainSlug)}><legend>1. Negocio</legend><div className="form-grid">
          <label>Nombre<input value={form.name} onChange={(event) => { const name = event.target.value; const syncSlug = !form.slug || form.slug === slugifyName(form.name); setForm({ ...form, name, slug: syncSlug ? slugifyName(name) : form.slug }); }} required /></label>
          <label>Slug público<input value={form.slug} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" onChange={(event) => setForm({ ...form, slug: event.target.value })} required /></label>
        </div></fieldset>
        <fieldset disabled={submitting || Boolean(uncertainSlug)}><legend>2. Usuario y contraseña</legend><div className="form-grid">
          <label>Nombre del propietario<input value={form.owner_name} onChange={(event) => setForm({ ...form, owner_name: event.target.value })} placeholder="Nombre de la persona responsable" required /></label>
          <label>Usuario (correo)<input type="email" value={form.owner_email} onChange={(event) => setForm({ ...form, owner_email: event.target.value })} placeholder="propietario@restaurante.pe" autoComplete="off" required /></label>
          <label className="owner-password-field">Contraseña<div className="password-input-row"><input type={showOwnerPassword ? "text" : "password"} value={form.owner_password} minLength={12} onChange={(event) => setForm({ ...form, owner_password: event.target.value })} autoComplete="new-password" required /><button type="button" title={showOwnerPassword ? "Ocultar contraseña" : "Mostrar contraseña"} onClick={() => setShowOwnerPassword((value) => !value)}>{showOwnerPassword ? <EyeOff /> : <Eye />}</button><button type="button" title="Generar otra contraseña" onClick={() => setForm({ ...form, owner_password: generateSecurePassword() })}><RefreshCw /></button></div><small>Mínimo 12 caracteres con mayúscula, minúscula, número y símbolo.</small></label>
        </div></fieldset>
        <fieldset disabled={submitting || Boolean(uncertainSlug)}><legend>3. Sucursal principal</legend><div className="form-grid">
          <label>Nombre de la sede<input value={form.branch_name} onChange={(event) => { const name = event.target.value; const syncSlug = !form.branch_slug || form.branch_slug === slugifyName(form.branch_name); setForm({ ...form, branch_name: name, branch_slug: syncSlug ? slugifyName(name) : form.branch_slug }); }} required /></label>
          <label>Slug de la sede<input value={form.branch_slug} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" onChange={(event) => setForm({ ...form, branch_slug: event.target.value })} required /></label>
          <label>Dirección<input value={form.branch_address} onChange={(event) => setForm({ ...form, branch_address: event.target.value })} /></label>
          <label>Teléfono del local<input value={form.branch_phone} onChange={(event) => setForm({ ...form, branch_phone: event.target.value })} /></label>
        </div></fieldset>
        <p>POS completo incluido. Los permisos de empleados y las modalidades del local se configuran dentro del POS.</p>
        <button className="button primary large" disabled={submitting || Boolean(uncertainSlug)}><Building2 /> {submitting ? "Preparando restaurante..." : "Crear restaurante y APIs"}</button>
        <small>La contraseña viaja cifrada por HTTPS a Supabase Auth y no se guarda en la base del POS. El acceso y el token del agente se mostrarán una sola vez.</small>
      </form>
    </OnboardingDialog>}

    {onboarding && <OnboardingDialog className="onboarding-result-modal" label="Accesos del restaurante" onClose={closeOnboarding}>
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
        <div><KeyRound /><span><strong>Token privado mostrado una sola vez</strong><small>Úsalo como credencial Bearer de las APIs de este restaurante.</small></span></div>
        <code>{onboarding.credential.token}</code>
        <button className="button secondary" onClick={() => void copy(onboarding.credential.token, "Token copiado.")}><Copy /> Copiar token</button>
      </section>
      <IntegrationPackageView integration={onboarding.integration} token={onboarding.credential.token} copy={copy} />
      <button className="button primary large" onClick={closeOnboarding}>Ya guardé el acceso y las APIs, cerrar</button>
    </OnboardingDialog>}

    {toast && <Toast {...toast} onClose={() => setToast(null)} />}
  </div>;
}
