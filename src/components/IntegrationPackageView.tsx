import { Copy } from "lucide-react";
import type { IntegrationPackage, PosNotificationsConnection } from "../types";
import { buildDeploymentPackage, buildIntegrationPackage } from "../lib/onboarding";

export function IntegrationPackageView({ integration, token, copy, completeDeployment = false, posNotifications }: {
  integration: IntegrationPackage;
  token?: string;
  completeDeployment?: boolean;
  posNotifications?: PosNotificationsConnection | null;
  copy: (value: string, message: string) => Promise<void>;
}) {
  const deploymentPackage = completeDeployment ? buildDeploymentPackage(integration, token, posNotifications) : null;
  const fields = [
    ["Dirección base", integration.api_base_url],
    ["Negocio", String(integration.business_id)],
    ["Sucursal", String(integration.branch_id)],
    ["Autenticación", `Authorization: Bearer ${token || "<TOKEN_PRIVADO>"}`],
    ["Permisos", integration.scopes.join(", ")],
  ];
  return <section className="endpoint-package">
    <header><div><h3>APIs privadas del restaurante</h3><p>Las rutas son compartidas. La credencial limita el acceso a este negocio y sucursal.</p></div>{completeDeployment
      ? <button className="button primary" disabled={!deploymentPackage} onClick={() => { if (deploymentPackage) void copy(deploymentPackage, "Paquete completo para n8n copiado."); }}><Copy /> Copiar paquete completo para n8n</button>
      : <button className="button primary" onClick={() => void copy(buildIntegrationPackage(integration, token), "Paquete de APIs copiado.")}><Copy /> Copiar paquete de APIs</button>}</header>
    {completeDeployment && <p>{deploymentPackage
      ? "Incluye la conexión del agente y una credencial separada para los avisos del POS. Guarda el paquete completo: ambos tokens se entregan una sola vez."
      : "El paquete completo no está disponible: falta una de las conexiones o no corresponde a esta sucursal. Conserva el token recibido y revisa el alta; no se emitirán otras credenciales automáticamente."}</p>}
    <div>{fields.map(([label, value]) => <article key={label}><div><strong>{label}</strong><code>{value}</code></div><button aria-label={`Copiar ${label}`} onClick={() => void copy(value, `${label} copiado.`)}><Copy /></button></article>)}</div>
    {!token && <p>El token no puede recuperarse. Usa el que guardaste al crear la credencial.</p>}
    {deploymentPackage && posNotifications && <div className="secret-once"><strong>Token de avisos del POS mostrado una sola vez</strong><code>{posNotifications.credential.token}</code><small>Permisos: {posNotifications.integration.scopes.join(", ")}. Esta conexión está separada de la del agente.</small></div>}
    <p>Cada escritura requiere un encabezado Idempotency-Key único por operación. Reutilízalo solo al reintentar esa misma operación.</p>
    <div>{Object.entries(integration.endpoints).map(([key, endpoint]) => <article key={key}><span className={`http-method method-${endpoint.method.toLowerCase()}`}>{endpoint.method}</span><div><strong>{key}</strong><code>{endpoint.url}</code><small>{endpoint.scope}</small></div><button aria-label={`Copiar ${key}`} onClick={() => void copy(endpoint.url, "Ruta copiada.")}><Copy /></button></article>)}</div>
  </section>;
}
