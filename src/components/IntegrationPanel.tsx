import { Ban, Bot, Check, Copy, KeyRound, MapPin, RotateCw, Save, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { useResource } from "../lib/hooks";
import type { Branch, IntegrationCredential, IntegrationPackage } from "../types";
import { IntegrationPackageView } from "./IntegrationPackageView";
import { Empty, ErrorBox, Loading, Status } from "./ui";

const availableScopes = [
  ["menu:read", "Carta y precios"],
  ["inventory:read", "Disponibilidad"],
  ["inventory:write", "Ajustes de inventario"],
  ["orders:read", "Consulta de pedidos"],
  ["orders:write", "Crear y actualizar pedidos"],
  ["payments:write", "Registrar comprobantes"],
  ["reservations:write", "Crear reservas"],
  ["events:read", "Notificaciones al cliente"],
] as const;

const defaultScopes = availableScopes.map(([scope]) => scope).filter((scope) => scope !== "inventory:write");

export function IntegrationPanel({ branches, onBranchUpdated }: { branches: Branch[]; onBranchUpdated: () => Promise<void> }) {
  const [selectedId, setSelectedId] = useState(branches[0]?.id || 0);
  const selected = branches.find((branch) => branch.id === selectedId) || branches[0];

  if (!selected) return <section className="panel integration-panel"><Empty title="Primero crea una sucursal" detail="Las credenciales del agente siempre pertenecen a una sucursal concreta." /></section>;

  return <section className="panel integration-panel">
    <header>
      <div><span className="eyebrow">Escalar AI</span><h2>Integración del agente</h2><p>Credenciales, ubicación y pagos disponibles mediante las APIs de esta sede.</p></div>
      <Bot />
    </header>
    <label className="branch-selector">Sucursal<select value={selected.id} onChange={(event) => setSelectedId(Number(event.target.value))}>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
    <BranchIntegration key={selected.id} branch={selected} onBranchUpdated={onBranchUpdated} />
  </section>;
}

function BranchIntegration({ branch, onBranchUpdated }: { branch: Branch; onBranchUpdated: () => Promise<void> }) {
  const credentials = useResource(() => api<IntegrationCredential[]>(`/admin/integration-credentials?branch_id=${branch.id}`), [branch.id]);
  const actionLock = useRef(false);
  const packageRequest = useRef(0);
  const [integration, setIntegration] = useState<IntegrationPackage | null>(null);
  const [name, setName] = useState("Agente WhatsApp principal");
  const [scopes, setScopes] = useState<string[]>(defaultScopes);
  const [secret, setSecret] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [branchForm, setBranchForm] = useState({
    address: branch.address || "",
    phone: branch.phone || "",
    maps_url: branch.maps_url || "",
    yape_number: branch.yape_number || "",
    plin_number: branch.plin_number || "",
    payment_recipient_name: branch.payment_recipient_name || "",
    delivery_fee: branch.delivery_fee || 0,
  });
  useEffect(() => {
    const requests = packageRequest;
    return () => { requests.current++; };
  }, []);

  function toggleScope(scope: string) {
    setScopes((current) => current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope]);
  }

  async function showPackage(item: IntegrationCredential) {
    const request = ++packageRequest.current;
    setError(null);
    try {
      const result = await api<{ integration: IntegrationPackage }>(`/admin/branches/${branch.id}/integration?credential_id=${item.id}`);
      if (request !== packageRequest.current) return;
      setIntegration(result.integration);
    } catch (caught) { if (request === packageRequest.current) setError(caught instanceof Error ? caught.message : "No se pudo consultar las APIs"); }
  }

  async function copy(value: string, message: string) {
    try { await navigator.clipboard.writeText(value); setMessage(message); }
    catch { setError("No se pudo copiar. Selecciona el dato y cópialo manualmente."); }
  }

  async function createCredential() {
    if (actionLock.current || !name.trim() || scopes.length === 0) return;
    actionLock.current = true;
    setWorking(true); setError(null); setMessage(null);
    try {
      const result = await api<IntegrationCredential>("/admin/integration-credentials", {
        method: "POST",
        body: JSON.stringify({ branch_id: branch.id, name: name.trim(), scopes }),
      });
      setSecret(result.token || null);
      setMessage("Credencial creada. Guarda el secreto ahora: no volverá a mostrarse.");
      await credentials.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo crear la credencial"); }
    finally { actionLock.current = false; setWorking(false); }
  }

  async function rotateCredential(item: IntegrationCredential) {
    if (actionLock.current) return;
    if (!window.confirm(`¿Rotar la credencial ${item.name}? El token anterior dejará de funcionar inmediatamente.`)) return;
    actionLock.current = true;
    setWorking(true); setError(null); setMessage(null);
    try {
      const result = await api<IntegrationCredential>(`/admin/integration-credentials/${item.id}/rotate`, { method: "POST" });
      setSecret(result.token || null);
      setMessage("Credencial rotada. Actualiza tu integración con este secreto antes de cerrar esta pantalla.");
      await credentials.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo rotar la credencial"); }
    finally { actionLock.current = false; setWorking(false); }
  }

  async function revokeCredential(item: IntegrationCredential) {
    if (actionLock.current) return;
    if (!window.confirm(`¿Revocar ${item.name}? El agente perderá acceso a esta sucursal.`)) return;
    actionLock.current = true;
    setWorking(true); setError(null); setMessage(null);
    try {
      await api(`/admin/integration-credentials/${item.id}/revoke`, { method: "POST" });
      setMessage("Credencial revocada y registrada en auditoría.");
      await credentials.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo revocar la credencial"); }
    finally { actionLock.current = false; setWorking(false); }
  }

  async function saveBranch() {
    if (actionLock.current) return;
    actionLock.current = true;
    setWorking(true); setError(null); setMessage(null);
    try {
      await api(`/branches/${branch.id}`, { method: "PATCH", body: JSON.stringify(branchForm) });
      if (qrFile) {
        const body = new FormData();
        body.append("file", qrFile);
        await api(`/branches/${branch.id}/yape-qr`, { method: "POST", body });
        setQrFile(null);
      }
      await onBranchUpdated();
      setMessage("Configuración de la sucursal actualizada.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo guardar la sucursal"); }
    finally { actionLock.current = false; setWorking(false); }
  }

  async function copySecret() {
    if (!secret) return;
    await copy(secret, "Secreto copiado. Guárdalo en un lugar seguro.");
  }

  return <div className="integration-layout">
    <div className="integration-column">
      <div className="integration-heading"><KeyRound /><div><h3>Credenciales por sucursal</h3><p>El token queda limitado a este negocio, esta sede y los permisos seleccionados.</p></div></div>
      {secret && <div className="secret-once"><strong>Secreto de un solo uso</strong><code>{secret}</code><button className="button secondary" onClick={() => void copySecret()}><Copy /> Copiar</button><small>Cuando cierres o recargues la página, la API no podrá devolverlo nuevamente.</small></div>}
      {message && <div className="integration-success"><Check /> {message}</div>}
      {error && <div className="form-error">{error}</div>}
      <div className="credential-list">
        {credentials.loading && !credentials.data ? <Loading label="Consultando credenciales..." /> : credentials.error && !credentials.data ? <ErrorBox message={credentials.error} retry={() => void credentials.refresh()} /> : credentials.data?.length ? credentials.data.map((item) => <article key={item.id}>
          <div><strong>{item.name}</strong><code>{item.token_prefix}...</code><small>Último uso: {item.last_used_at ? new Date(item.last_used_at).toLocaleString("es-PE") : "Nunca"}</small></div>
          <Status value={item.active ? "active" : "suspended"} />
          <div className="credential-scopes">{item.scopes.map((scope) => <span key={scope}>{scope}</span>)}</div>
          <div className="credential-actions"><button disabled={working} onClick={() => void showPackage(item)}>Ver APIs</button><button title="Rotar credencial" disabled={working} onClick={() => void rotateCredential(item)}><RotateCw /></button>{item.active && <button className="text-danger" title="Revocar credencial" disabled={working} onClick={() => void revokeCredential(item)}><Ban /></button>}</div>
        </article>) : <Empty title="Sin credenciales" detail="Crea una para acceder a las APIs de esta sucursal." />}
      </div>
      {integration && <IntegrationPackageView integration={integration} copy={copy} />}
      <div className="credential-create">
        <label>Nombre de la credencial<input value={name} onChange={(event) => setName(event.target.value)} /></label>
        <fieldset><legend>Permisos del agente</legend><div className="scope-grid">{availableScopes.map(([scope, label]) => <label key={scope} className={scope === "inventory:write" ? "scope-sensitive" : ""}><input type="checkbox" checked={scopes.includes(scope)} onChange={() => toggleScope(scope)} /><span><strong>{label}</strong><small>{scope}</small></span></label>)}</div></fieldset>
        <button className="button primary" disabled={working || !name.trim() || scopes.length === 0} onClick={() => void createCredential()}><KeyRound /> Crear y mostrar secreto una vez</button>
      </div>
    </div>

    <div className="integration-column branch-agent-config">
      <div className="integration-heading"><MapPin /><div><h3>Contexto que recibirá el agente</h3><p>Información pública del local y datos de cobro, sin exponer secretos administrativos.</p></div></div>
      <div className="form-grid">
        <label className="wide-field">Dirección<textarea rows={2} value={branchForm.address} onChange={(event) => setBranchForm({ ...branchForm, address: event.target.value })} /></label>
        <label>Teléfono<input value={branchForm.phone} onChange={(event) => setBranchForm({ ...branchForm, phone: event.target.value })} /></label>
        <label>Costo de delivery<input type="number" min="0" step="0.1" value={branchForm.delivery_fee} onChange={(event) => setBranchForm({ ...branchForm, delivery_fee: Number(event.target.value) })} /></label>
        <label className="wide-field">Google Maps<input type="url" value={branchForm.maps_url} onChange={(event) => setBranchForm({ ...branchForm, maps_url: event.target.value })} placeholder="https://maps.google.com/..." /></label>
        <label>Número Yape<input value={branchForm.yape_number} onChange={(event) => setBranchForm({ ...branchForm, yape_number: event.target.value })} /></label>
        <label>Número Plin<input value={branchForm.plin_number} onChange={(event) => setBranchForm({ ...branchForm, plin_number: event.target.value })} /></label>
        <label className="wide-field">Titular del pago<input value={branchForm.payment_recipient_name} onChange={(event) => setBranchForm({ ...branchForm, payment_recipient_name: event.target.value })} /></label>
      </div>
      <label className="admin-file-drop"><Upload /><span><strong>{qrFile?.name || (branch.yape_qr_configured || branch.yape_qr_storage_path ? "QR de Yape configurado" : "Subir QR de Yape")}</strong><small>Imagen privada, máximo 5 MB.</small></span><input type="file" accept="image/*" onChange={(event) => setQrFile(event.target.files?.[0] || null)} /></label>
      <button className="button primary" disabled={working} onClick={() => void saveBranch()}><Save /> Guardar contexto del agente</button>
    </div>
  </div>;
}
