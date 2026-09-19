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
    <p>Cada escritura requiere un encabezado Idempotency-Key único por operación. Reutilízalo solo al reintentar esa misma operación.</p>
    <div>{Object.entries(integration.endpoints).map(([key, endpoint]) => <article key={key}><span className={`http-method method-${endpoint.method.toLowerCase()}`}>{endpoint.method}</span><div><strong>{key}</strong><code>{endpoint.url}</code><small>{endpoint.scope}</small></div><button aria-label={`Copiar ${key}`} onClick={() => void copy(endpoint.url, "Ruta copiada.")}><Copy /></button></article>)}</div>
  </section>;
}
