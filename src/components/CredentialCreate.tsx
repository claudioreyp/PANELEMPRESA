import { Copy, KeyRound, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "../lib/api";
import type { Branch, IntegrationCredential, IntegrationPackage } from "../types";
import { IntegrationPackageView } from "./IntegrationPackageView";

const scopes = [
  ["menu:read", "Carta y precios"], ["inventory:read", "Disponibilidad"],
  ["orders:read", "Consulta de pedidos"], ["orders:write", "Crear y actualizar pedidos"],
  ["payments:write", "Registrar comprobantes"], ["reservations:write", "Crear reservas"],
  ["events:read", "Notificaciones al cliente"], ["inventory:write", "Ajustes de inventario"],
] as const;
type Issuance = IntegrationCredential & { operation_id: string; secret_available: boolean };
type Operation = { key: string; body: string; status: "unknown" | "not_found" };
type Lookup = { status: "created" | "not_found" | "requires_review"; credential?: IntegrationCredential };

export function CredentialCreate({ branch, businessName, onCreated }: {
  branch: Branch; businessName: string; onCreated: () => void;
}) {
  const [name, setName] = useState("Agente WhatsApp adicional");
  const [selected, setSelected] = useState<string[]>(scopes.map(([scope]) => scope).filter(scope => scope !== "inventory:write"));
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

  async function loadPackage(item: IntegrationCredential, request: number) {
    try {
      const value = await api<{ integration: IntegrationPackage }>(`/admin/branches/${branch.id}/integration?credential_id=${item.id}`);
      if (generation.current === request) setIntegration(value.integration);
    } catch { if (generation.current === request) setMessage("La credencial está creada. No pudimos cargar las rutas; conserva el token y vuelve a consultar las APIs."); }
  }

  async function submit(retry?: Operation) {
    if (locked.current || issued || (!retry && operation) || !name.trim() || !selected.length) return;
    locked.current = true; setBusy(true); setMessage("");
    const request = generation.current;
    const attempt = retry || { key: crypto.randomUUID(), body: JSON.stringify({ branch_id: branch.id, name: name.trim(), scopes: selected }), status: "unknown" as const };
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
    if (locked.current || !operation) return;
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
    if (issued?.token && !window.confirm("El token no podrá recuperarse después de cerrar. ¿Ya lo guardaste de forma segura?")) return;
    generation.current++; setIssued(null); setIntegration(null); setMessage("");
  }

  return <div className="credential-create">
    <h3>Crear credencial adicional</h3>
    <p>Una nueva llave de acceso para <strong>{businessName}</strong>, sucursal <strong>{branch.name}</strong>. No reemplaza ni revoca las existentes.</p>
    <small>Negocio {branch.business_id} · Sucursal {branch.id}</small>
    {issued ? <div className="form-stack" role="status">
      <strong>Credencial creada: {issued.name}</strong>
      <small>Credencial #{issued.id} · {issued.token_prefix}…</small>
      {issued.token ? <div className="secret-once"><strong>Este token se muestra una sola vez</strong><code>{issued.token}</code><button className="button secondary" onClick={() => void copy(issued.token!, "Token copiado.")}><Copy /> Copiar token</button><small>Es reutilizable hasta su vencimiento o revocación. Al cerrar esta pantalla ya no podrás recuperarlo.</small></div>
        : <p>La emisión está confirmada, pero el token no pudo recuperarse. No uses el marcador TOKEN_PRIVADO. Revisa y revoca esta credencial si no la guardaste, antes de emitir otra de forma explícita.</p>}
      {integration && <IntegrationPackageView integration={integration} token={issued.token} copy={copy} />}
      <button className="button secondary" disabled={busy} onClick={closeSecret}><X /> Cerrar resultado</button>
    </div> : operation ? <div className="form-stack" role="status">
      <strong>Emisión pendiente de comprobación</strong>
      <small>Operación: {operation.key}</small>
      <button className="button secondary" disabled={busy} onClick={() => void check()}>{busy ? "Consultando…" : "Consultar resultado"}</button>
      {operation.status === "not_found" && <button className="button secondary" disabled={busy} onClick={() => void submit(operation)}>Reenviar la misma operación</button>}
    </div> : <>
      <label>Nombre de la credencial<input maxLength={120} value={name} disabled={busy} onChange={event => setName(event.target.value)} /></label>
      <fieldset disabled={busy}><legend>Permisos de la credencial adicional</legend><div className="scope-grid">{scopes.map(([scope, label]) => <label key={scope} className={scope === "inventory:write" ? "scope-sensitive" : ""}><input type="checkbox" checked={selected.includes(scope)} onChange={() => setSelected(current => current.includes(scope) ? current.filter(item => item !== scope) : [...current, scope])} /><span><strong>{label}</strong><small>{scope}</small></span></label>)}</div></fieldset>
      <button className="button primary" disabled={busy || name.trim().length < 2 || !selected.length} onClick={() => void submit()}><KeyRound /> Crear credencial adicional</button>
    </>}
    {message && <p role="status">{message}</p>}
  </div>;
}
