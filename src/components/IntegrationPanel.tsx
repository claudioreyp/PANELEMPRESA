import { Ban, Bot, Check, Copy, KeyRound, RotateCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { useResource } from "../lib/hooks";
import type { Branch, IntegrationCredential, IntegrationPackage } from "../types";
import { IntegrationPackageView } from "./IntegrationPackageView";
import { AgentContextSummary } from "./AgentContextSummary";
import { Empty, ErrorBox, Loading, Status } from "./ui";
import { CredentialCreate } from "./CredentialCreate";

export function IntegrationPanel({ branches, businessName }: { branches: Branch[]; businessName: string }) {
  const [selectedId, setSelectedId] = useState(branches[0]?.id || 0);
  const selected = branches.find((branch) => branch.id === selectedId) || branches[0];

  if (!selected) return <section className="panel integration-panel"><Empty title="Primero crea una sucursal" detail="Las credenciales del agente siempre pertenecen a una sucursal concreta." /></section>;

  return <section className="panel integration-panel">
    <header>
      <div><span className="eyebrow">Escalar AI</span><h2>Integración del agente</h2><p>Credenciales, ubicación y pagos disponibles mediante las APIs de esta sede.</p></div>
      <Bot />
    </header>
    <label className="branch-selector">Sucursal<select value={selected.id} onChange={(event) => setSelectedId(Number(event.target.value))}>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
    <BranchIntegration key={selected.id} branch={selected} businessName={businessName} />
  </section>;
}

function BranchIntegration({ branch, businessName }: { branch: Branch; businessName: string }) {
  const credentials = useResource(() => api<IntegrationCredential[]>(`/admin/integration-credentials?branch_id=${branch.id}`), [branch.id]);
  const actionLock = useRef(false);
  const packageRequest = useRef(0);
  const [integration, setIntegration] = useState<IntegrationPackage | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const requests = packageRequest;
    return () => { requests.current++; };
  }, []);

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

  async function copySecret() {
    if (!secret) return;
    await copy(secret, "Secreto copiado. Guárdalo en un lugar seguro.");
  }

  return <div className="integration-layout">
    <div className="integration-column">
      <div className="integration-heading"><KeyRound /><div><h3>Credenciales por sucursal</h3><p>El token queda limitado a este negocio, esta sede y los permisos seleccionados.</p></div></div>
      {secret && <div className="secret-once"><strong>Token rotado: se muestra una sola vez</strong><code>{secret}</code><button className="button secondary" onClick={() => void copySecret()}><Copy /> Copiar</button><button className="button secondary" onClick={() => setSecret(null)}>Ocultar token</button><small>Es reutilizable. Cuando cierres o recargues la página, la API no podrá devolverlo nuevamente.</small></div>}
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
      <CredentialCreate branch={branch} businessName={businessName} onCreated={() => void credentials.refresh()} />
    </div>

    <AgentContextSummary branchId={branch.id} />
  </div>;
}
