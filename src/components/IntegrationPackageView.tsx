import { Copy } from "lucide-react";
import type { IntegrationPackage } from "../types";
import { buildIntegrationPackage } from "../lib/onboarding";

export function IntegrationPackageView({ integration, token, copy }: {
  integration: IntegrationPackage;
  token?: string;
  copy: (value: string, message: string) => Promise<void>;
}) {
  const fields = [
    ["Dirección base", integration.api_base_url],
    ["Negocio", String(integration.business_id)],
    ["Sucursal", String(integration.branch_id)],
    ["Autenticación", `Authorization: Bearer ${token || "<TOKEN_PRIVADO>"}`],
    ["Permisos", integration.scopes.join(", ")],
  ];
  return <section className="endpoint-package">
    <header><div><h3>APIs privadas del restaurante</h3><p>Las rutas son compartidas. La credencial limita el acceso a este negocio y sucursal.</p></div><button className="button primary" onClick={() => void copy(buildIntegrationPackage(integration, token), "Paquete de APIs copiado.")}><Copy /> Copiar paquete de APIs</button></header>
    <div>{fields.map(([label, value]) => <article key={label}><div><strong>{label}</strong><code>{value}</code></div><button aria-label={`Copiar ${label}`} onClick={() => void copy(value, `${label} copiado.`)}><Copy /></button></article>)}</div>
    {!token && <p>El token no puede recuperarse. Usa el que guardaste al crear la credencial.</p>}
    {integration.api_contract_version && <p>Contrato de APIs: {integration.api_contract_version}. El paquete incluye parámetros, respuestas y permisos de cada herramienta.</p>}
    <p>Las operaciones que requieren Idempotency-Key deben conservar la misma clave al reintentarse. Consulta el requisito de cada herramienta en el paquete.</p>
    <div>{Object.entries(integration.endpoints).map(([key, endpoint]) => <article key={key}><span className={`http-method method-${endpoint.method.toLowerCase()}`}>{endpoint.method}</span><div><strong>{key}</strong>{endpoint.description && <p>{endpoint.description}</p>}<code>{endpoint.url}</code><small>{(endpoint.required_scopes || [endpoint.scope]).join(", ")}{endpoint.read_only ? " · Solo consulta" : ""}</small></div><button aria-label={`Copiar ${key}`} onClick={() => void copy(endpoint.url, "Ruta copiada.")}><Copy /></button></article>)}</div>
  </section>;
}
