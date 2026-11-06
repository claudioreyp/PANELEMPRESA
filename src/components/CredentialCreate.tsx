import { Copy, KeyRound, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "../lib/api";
import type { Branch, IntegrationCredential, IntegrationPackage, IntegrationProfile, PosNotificationsConnection } from "../types";
import { IntegrationPackageView } from "./IntegrationPackageView";
import { deploymentConnection, deploymentProfile, deploymentScopes, type DeploymentRole } from "../lib/existingDeployment";

const scopes = [
  ["menu:read", "Carta y precios"], ["inventory:read", "Disponibilidad"],
  ["orders:read", "Consulta de pedidos"], ["orders:write", "Crear y actualizar pedidos"],
  ["payments:write", "Registrar comprobantes"], ["reservations:write", "Crear reservas"],
  ["events:read", "Notificaciones al cliente"], ["inventory:write", "Ajustes de inventario"],
  ["events:deliver", "Entregar avisos del POS"],
] as const;
const agentScopes = [
  ["menu:read", "Carta, precios y disponibilidad"], ["orders:read", "Pedidos del consumidor"],
  ["orders:write", "Pedidos y cambios permitidos"], ["payments:write", "Registrar comprobantes"],
  ["agent:state", "Continuidad de la conversación"], ["agent:attention", "Solicitar atención humana"],
] as const;
type Issuance = IntegrationCredential & { operation_id: string; secret_available: boolean };
type Operation = { key: string; body: string; status: "unknown" | "not_found" };
type Lookup = { status: "created" | "not_found" | "requires_review"; credential?: IntegrationCredential };

export function CredentialCreate({ branch, businessName, onCreated, purpose, onPackageReady, onProtectionChange, disabled = false }: {
  branch: Branch; businessName: string; onCreated: () => void;
  purpose?: DeploymentRole;
  onPackageReady?: (connection: PosNotificationsConnection | null) => void;
  onProtectionChange?: (protectedState: boolean) => void;
  disabled?: boolean;
}) {
  const [name, setName] = useState(purpose ? `${purpose === "agent" ? "Agente n8n" : "Avisos POS"} - ${branch.name}`.slice(0, 120) : "Agente WhatsApp adicional");
  const [profile, setProfile] = useState<IntegrationProfile>(purpose ? deploymentProfile(purpose) : "restaurant_agent");
  const [selected, setSelected] = useState<string[]>(purpose ? deploymentScopes[purpose] : agentScopes.map(([scope]) => scope));
  const [busy, setBusy] = useState(false);
  const [operation, setOperation] = useState<Operation | null>(null);
  const [issued, setIssued] = useState<Issuance | null>(null);
  const [integration, setIntegration] = useState<IntegrationPackage | null>(null);
  const [message, setMessage] = useState("");
  const locked = useRef(false);
  const generation = useRef(0);

  useEffect(() => {
    const current = generation;
    return () => { current.current++; };
  }, []);
  useEffect(() => {
    if (!issued?.token && !operation && !busy) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [issued, operation, busy]);
  useEffect(() => { onProtectionChange?.(Boolean(issued?.token || operation || busy)); }, [issued, operation, busy, onProtectionChange]);
  useEffect(() => () => onProtectionChange?.(false), [onProtectionChange]);

  async function loadPackage(item: IntegrationCredential, request: number) {
    try {
      const value = await api<{ integration: IntegrationPackage; credential?: IntegrationCredential }>(`/admin/branches/${branch.id}/integration?credential_id=${item.id}`);
      if (generation.current !== request) return;
      if (purpose) {
        const connection = value.credential?.id === item.id && item.token
          ? deploymentConnection(value.credential, value.integration, item.token, purpose, branch) : null;
        if (item.token && !connection) throw new Error("La conexión no corresponde a esta sucursal o ya no está vigente.");
        onPackageReady?.(connection);
      }
      setIntegration(value.integration); setMessage("");
    } catch { if (generation.current === request) setMessage("La credencial está creada. No pudimos cargar las rutas; conserva el token y vuelve a consultar las APIs."); }
  }

  async function submit(retry?: Operation) {
    if (disabled || locked.current || issued || (!retry && operation) || !name.trim() || !selected.length) return;
    locked.current = true; setBusy(true); setMessage("");
    const request = generation.current;
    const attempt = retry || { key: crypto.randomUUID(), body: JSON.stringify({ branch_id: branch.id, name: name.trim(), profile, scopes: selected }), status: "unknown" as const };
    setOperation({ ...attempt, status: "unknown" });
    try {
      const result = await api<Issuance>("/admin/integration-credentials", {
        method: "POST", headers: { "Idempotency-Key": attempt.key }, body: attempt.body,
      });
      if (generation.current !== request) return;
      setIssued(result); setOperation(null); onCreated();
      await loadPackage(result, request);
    } catch (error) {
      if (generation.current !== request) return;
      if (error instanceof ApiError && [400, 401, 403, 404, 422].includes(error.status)) {
        setOperation(null); setMessage(error.message);
      } else setMessage("No pudimos confirmar la emisión. Consulta el resultado antes de intentar otra; no se ha repetido la solicitud.");
    } finally { locked.current = false; if (generation.current === request) setBusy(false); }
  }

  async function check() {
    if (disabled || locked.current || !operation) return;
    locked.current = true; setBusy(true); setMessage("");
    const request = generation.current;
    try {
      const result = await api<Lookup>(`/admin/integration-credentials/operations/${operation.key}?branch_id=${branch.id}`);
      if (generation.current !== request) return;
      if (result.status === "created" && result.credential) {
        setIssued({ ...result.credential, operation_id: operation.key, secret_available: false });
        setOperation(null); onCreated(); await loadPackage(result.credential, request);
      } else if (result.status === "not_found") {
        setOperation({ ...operation, status: "not_found" });
        setMessage("La API todavía no registra esta emisión. Puedes consultar otra vez o reenviar la misma operación, sin generar otra clave.");
      } else setMessage("La emisión requiere revisión administrativa. No se creará otra credencial automáticamente.");
    } catch { if (generation.current === request) setMessage("No pudimos comprobar el resultado. Conservamos la operación para volver a consultar."); }
    finally { locked.current = false; if (generation.current === request) setBusy(false); }
  }

  async function copy(value: string, success: string) {
    const request = generation.current;
    try { await navigator.clipboard.writeText(value); if (generation.current === request) setMessage(success); }
    catch { if (generation.current === request) setMessage("No se pudo copiar. Selecciona el dato para copiarlo manualmente."); }
  }

  function closeSecret() {
    if (disabled) return;
    if (issued?.token && !window.confirm("El token no podrá recuperarse después de cerrar. ¿Ya lo guardaste de forma segura?")) return;
    generation.current++; setIssued(null); setIntegration(null); setMessage(""); onPackageReady?.(null);
  }

  async function reloadPackage() {
    if (disabled || locked.current || !issued) return;
    locked.current = true; setBusy(true); setMessage("");
    try { await loadPackage(issued, generation.current); }
    finally { locked.current = false; setBusy(false); }
  }

  const createLabel = purpose === "agent" ? "Crear credencial del agente" : purpose === "notices" ? "Crear credencial de avisos del POS" : "Crear credencial adicional";

  return <div className="credential-create">
    <h3>{purpose ? "Crear una conexión adicional" : "Crear credencial adicional"}</h3>
    <p>Una nueva llave de acceso para <strong>{businessName}</strong>, sucursal <strong>{branch.name}</strong>. No reemplaza ni revoca las existentes.</p>
    <small>Negocio {branch.business_id} · Sucursal {branch.id}</small>
    {issued ? <div className="form-stack" role="status">
      <strong>Credencial creada: {issued.name}</strong>
      <small>Credencial #{issued.id} · {issued.token_prefix}…</small>
      {issued.token ? <div className="secret-once"><strong>Este token se muestra una sola vez</strong><code>{issued.token}</code><button className="button secondary" onClick={() => void copy(issued.token!, "Token copiado.")}><Copy /> Copiar token</button><small>Es reutilizable hasta su vencimiento o revocación. Al cerrar esta pantalla ya no podrás recuperarlo.</small></div>
        : <p>La emisión está confirmada, pero el token no pudo recuperarse. No uses el marcador TOKEN_PRIVADO. Revisa y revoca esta credencial si no la guardaste, antes de emitir otra de forma explícita.</p>}
      {!integration && <button className="button secondary" disabled={busy || disabled} onClick={() => void reloadPackage()}>Volver a consultar APIs</button>}
      {integration && !purpose && <IntegrationPackageView integration={integration} token={issued.token} copy={copy} />}
      {integration && purpose && issued.token && <p>Conexión preparada para el paquete completo.</p>}
      <button className="button secondary" disabled={busy || disabled} onClick={closeSecret}><X /> Cerrar resultado</button>
    </div> : operation ? <div className="form-stack" role="status">
      <strong>Emisión pendiente de comprobación</strong>
      <small>Operación: {operation.key}</small>
      <button className="button secondary" disabled={busy || disabled} onClick={() => void check()}>{busy ? "Consultando…" : "Consultar resultado"}</button>
      {operation.status === "not_found" && <button className="button secondary" disabled={busy || disabled} onClick={() => void submit(operation)}>Reenviar la misma operación</button>}
    </div> : <>
      <label>Nombre de la credencial<input maxLength={120} value={name} disabled={busy || disabled} onChange={event => setName(event.target.value)} /></label>
      {!purpose && <label>Perfil de integración<select value={profile} disabled={busy || disabled} onChange={event => {
        const next = event.target.value as IntegrationProfile; setProfile(next);
        setSelected(next === "restaurant_agent" ? agentScopes.map(([scope]) => scope) : scopes.map(([scope]) => scope).filter(scope => scope !== "inventory:write" && scope !== "events:deliver"));
      }}><option value="restaurant_agent">Agente de restaurante (recomendado)</option><option value="generic">Integración general</option></select></label>}
      {profile === "restaurant_agent" && <small>Atiende consumidores con pedidos propios. Las notificaciones operativas usan una conexión separada.</small>}
      {purpose ? <p>Permisos limitados: {deploymentScopes[purpose].join(", ")}. Las credenciales actuales seguirán funcionando.</p> : <fieldset disabled={busy || disabled}><legend>Permisos de la credencial adicional</legend><div className="scope-grid">{(profile === "restaurant_agent" ? agentScopes : scopes).map(([scope, label]) => <label key={scope} className={scope === "inventory:write" || scope === "events:deliver" ? "scope-sensitive" : ""}><input type="checkbox" checked={selected.includes(scope)} onChange={() => setSelected(current => current.includes(scope) ? current.filter(item => item !== scope) : [...current, scope])} /><span><strong>{label}</strong><small>{scope}</small></span></label>)}</div></fieldset>}
      <button className="button primary" disabled={busy || disabled || name.trim().length < 2 || !selected.length} onClick={() => void submit()}><KeyRound /> {createLabel}</button>
    </>}
    {message && <p role="status">{message}</p>}
  </div>;
}
