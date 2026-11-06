import { Copy, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { completeExistingDeployment, deploymentConnection, isDeploymentCredential, type DeploymentRole } from "../lib/existingDeployment";
import type { Branch, IntegrationCredential, IntegrationPackage, PosNotificationsConnection } from "../types";
import { CredentialCreate } from "./CredentialCreate";

type ContractResult = { credential: IntegrationCredential; integration: IntegrationPackage };
type Props = {
  branch: Branch; businessName: string; credentials: IntegrationCredential[]; onCreated: () => void;
  onProtectionChange?: (protectedState: boolean) => void;
};

export function ExistingDeploymentPackage({ branch, businessName, credentials, onCreated, onProtectionChange }: Props) {
  const [open, setOpen] = useState(false);
  const [agent, setAgent] = useState<PosNotificationsConnection | null>(null);
  const [notices, setNotices] = useState<PosNotificationsConnection | null>(null);
  const [agentProtected, protectAgent] = useState(false);
  const [noticesProtected, protectNotices] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const generation = useRef(0);
  const locked = useRef(false);
  const agentReady = useCallback((value: PosNotificationsConnection | null) => setAgent(value), []);
  const noticesReady = useCallback((value: PosNotificationsConnection | null) => setNotices(value), []);
  const agentProtection = useCallback((value: boolean) => protectAgent(value), []);
  const noticesProtection = useCallback((value: boolean) => protectNotices(value), []);
  const protectedState = agentProtected || noticesProtected || busy;

  useEffect(() => { onProtectionChange?.(open || protectedState); }, [open, protectedState, onProtectionChange]);
  useEffect(() => {
    const current = generation;
    return () => { current.current++; onProtectionChange?.(false); };
  }, [onProtectionChange]);
  useEffect(() => {
    if (!protectedState) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [protectedState]);

  function close() {
    if (locked.current) return;
    if (protectedState && !window.confirm("Al cerrar se borrarán los tokens de esta pantalla. Guarda el paquete y cualquier identificador de emisión pendiente antes de continuar. ¿Cerrar?")) return;
    generation.current++; setOpen(false); setAgent(null); setNotices(null);
    protectAgent(false); protectNotices(false); setMessage(""); setError("");
  }

  async function copyComplete() {
    if (locked.current || !agent || !notices || !completeExistingDeployment(agent, notices, branch)) return;
    locked.current = true; setBusy(true); setError(""); setMessage("");
    const request = generation.current;
    try {
      // Recheck both selected credentials before copying, including rotations since selection.
      const [agentNow, noticesNow] = await Promise.all([agent, notices].map(connection =>
        api<ContractResult>(`/admin/branches/${branch.id}/integration?credential_id=${connection.credential.id}`)));
      if (request !== generation.current) return;
      const freshAgent = agentNow.credential?.id === agent.credential.id && deploymentConnection(agentNow.credential, agentNow.integration, agent.credential.token || "", "agent", branch);
      const freshNotices = noticesNow.credential?.id === notices.credential.id && deploymentConnection(noticesNow.credential, noticesNow.integration, notices.credential.token || "", "notices", branch);
      const value = completeExistingDeployment(freshAgent || null, freshNotices || null, branch);
      if (!value) throw new Error("Una conexión ya no está vigente o el token no corresponde. Revisa ambas credenciales antes de copiar.");
      await navigator.clipboard.writeText(value);
      if (request === generation.current) setMessage("Paquete completo para n8n copiado. Pégalo en Codex y solicita usar $escalar-restaurante-n8n.");
    } catch (caught) {
      if (request === generation.current) setError(caught instanceof Error ? caught.message : "No se pudo copiar el paquete. Los tokens siguen en esta pantalla.");
    } finally { locked.current = false; if (request === generation.current) setBusy(false); }
  }

  return <section className="deployment-package" aria-label="Paquete completo para n8n">
    <header className="deployment-package-heading"><div><h3>Paquete completo para n8n</h3><p>Reúne las dos conexiones para copiar un solo paquete de {businessName}, sucursal {branch.name}.</p></div>
      {open ? <button className="button secondary" disabled={busy} onClick={close}><X /> Cerrar paquete</button>
        : <button className="button primary" onClick={() => setOpen(true)}><Copy /> Copiar paquete completo para n8n</button>}
    </header>
    {open && <>
      <p>Usa los tokens que guardaste o crea conexiones adicionales. Las credenciales existentes seguirán funcionando. Los tokens se mantienen sólo en esta pantalla.</p>
      <div className="deployment-roles">
        <ConnectionChoice role="agent" branch={branch} businessName={businessName} credentials={credentials} onCreated={onCreated} onReady={agentReady} onProtected={agentProtection} disabled={busy} />
        <ConnectionChoice role="notices" branch={branch} businessName={businessName} credentials={credentials} onCreated={onCreated} onReady={noticesReady} onProtected={noticesProtection} disabled={busy} />
      </div>
      <p className="deployment-summary">{agent ? "Agente preparado." : "Falta la conexión del agente."} {notices ? "Avisos del POS preparados." : "Falta la conexión de avisos del POS."}</p>
      <button className="button primary" disabled={busy || !completeExistingDeployment(agent, notices, branch)} onClick={() => void copyComplete()}><Copy /> {busy ? "Comprobando conexiones…" : "Copiar paquete completo para n8n"}</button>
      {message && <p className="integration-success" role="status">{message}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </>}
  </section>;
}

function ConnectionChoice({ role, branch, businessName, credentials, onCreated, onReady, onProtected, disabled }: {
  role: DeploymentRole; branch: Branch; businessName: string; credentials: IntegrationCredential[];
  onCreated: () => void; onReady: (connection: PosNotificationsConnection | null) => void;
  onProtected: (value: boolean) => void; disabled: boolean;
}) {
  const candidates = credentials.filter(credential => isDeploymentCredential(credential, role, branch));
  const [mode, setMode] = useState(candidates.length ? "existing" : "new");
  const [selectedId, setSelectedId] = useState(candidates[0]?.id || 0);
  const [token, setToken] = useState("");
  const [contract, setContract] = useState<ContractResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [newProtected, setNewProtected] = useState(false);
  const generation = useRef(0);
  const protectNew = useCallback((value: boolean) => setNewProtected(value), []);
  const label = role === "agent" ? "Conexión del agente" : "Avisos del POS";
  const tokenLabel = role === "agent" ? "Token del agente" : "Token de avisos del POS";
  const selectLabel = role === "agent" ? "Credencial del agente" : "Credencial de avisos del POS";
  const sourceLabel = role === "agent" ? "Origen de la conexión del agente" : "Origen de avisos del POS";
  const valid = contract && deploymentConnection(contract.credential, contract.integration, token, role, branch);

  useEffect(() => { onProtected(Boolean(token || newProtected || loading)); }, [token, newProtected, loading, onProtected]);
  useEffect(() => () => onProtected(false), [onProtected]);
  useEffect(() => {
    if (mode === "existing") onReady(contract && deploymentConnection(contract.credential, contract.integration, token, role, branch) || null);
  }, [mode, token, contract, role, branch, onReady]); // Recompute without retaining a token for another credential.

  useEffect(() => {
    const current = generation;
    const request = ++current.current;
    if (mode !== "existing" || !selectedId) return;
    setLoading(true); setError(""); setContract(null);
    void api<ContractResult>(`/admin/branches/${branch.id}/integration?credential_id=${selectedId}`).then(value => {
      if (request !== generation.current) return;
      if (!value.credential || value.credential.id !== selectedId || !isDeploymentCredential(value.credential, role, branch)) {
        setError("La credencial ya no está vigente para esta conexión."); return;
      }
      setContract(value);
    }).catch(() => { if (request === generation.current) setError("No se pudieron consultar las APIs. Pulsa «Volver a consultar APIs» para intentarlo de nuevo."); })
      .finally(() => { if (request === generation.current) setLoading(false); });
    return () => { current.current++; };
  }, [selectedId, mode, branch, role, reload]);

  function changeMode(next: string) {
    if ((token || newProtected) && !window.confirm("Se borrará el token o resultado de esta conexión. Guarda primero los datos y cualquier operación pendiente. ¿Continuar?")) return;
    generation.current++; setMode(next); setToken(""); setContract(null); setLoading(false); setError(""); onReady(null); setNewProtected(false);
  }

  return <div className="deployment-role form-stack" role="group" aria-label={label}>
    <h4>{label}</h4>
    <label>{sourceLabel}<select value={mode} disabled={disabled || loading} onChange={event => changeMode(event.target.value)}>
      <option value="existing">Usar una credencial existente</option><option value="new">Crear una credencial adicional</option>
    </select></label>
    {mode === "existing" ? <>
      <label>{selectLabel}<select value={selectedId} disabled={disabled || loading} onChange={event => { onReady(null); setToken(""); setContract(null); setSelectedId(Number(event.target.value)); }}>
        <option value={0}>Selecciona una credencial</option>{candidates.map(credential => <option key={credential.id} value={credential.id}>{credential.name} · {credential.token_prefix}…</option>)}
      </select></label>
      {!candidates.length && <p>No hay una credencial vigente con los permisos de esta conexión. Puedes crear una adicional sin reemplazar las actuales.</p>}
      <label>{tokenLabel}<input type="password" value={token} autoComplete="off" spellCheck={false} disabled={disabled || !selectedId} placeholder="Pega el token que guardaste" onChange={event => setToken(event.target.value)} /></label>
      <small>El token anterior no puede recuperarse. Pégalo completo, sin «Bearer».</small>
      {loading && <p role="status">Consultando APIs…</p>}
      {token && !loading && !valid && <p className="form-error">El token o contrato no corresponde a la credencial seleccionada.</p>}
      {valid && <p>Conexión preparada.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {error && <button className="button secondary" disabled={disabled || loading} onClick={() => setReload(current => current + 1)}>Volver a consultar APIs</button>}
    </> : <CredentialCreate branch={branch} businessName={businessName} purpose={role} disabled={disabled} onCreated={onCreated} onPackageReady={onReady} onProtectionChange={protectNew} />}
  </div>;
}
