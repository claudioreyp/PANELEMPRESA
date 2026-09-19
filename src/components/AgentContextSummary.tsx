import { MapPin } from "lucide-react";
import { api } from "../lib/api";
import { useResource } from "../lib/hooks";
import { ErrorBox, Loading } from "./ui";

export type AgentContext = {
  branch_id: number;
  agent: { name: string | null };
  location: { address: string | null; phone: string | null; maps_url: string | null; latitude: number | null; longitude: number | null };
  payments: { yape: { number: string | null; recipient_name: string | null; qr_configured: boolean }; plin_number: string | null };
  delivery: {
    enabled: boolean; mode: string; fee: number | null; fee_status: string;
    minimum_order_amount: number | null; free_delivery_threshold: number | null;
    distance_base_fee: number | null; distance_fee_per_km: number | null; distance_max_km: number | null;
    policy: { neighborhoods?: { name: string; fee: number }[]; outside_band_mode?: string } | null;
    bands: { id: number; minimum_km: number; maximum_km: number; fee: number }[];
  };
};

const amount = (value: number) => `${value.toLocaleString("es-PE")} S/`;
const configured = (value: string | null) => value || "Sin configurar";

export function AgentContextSummary({ branchId }: { branchId: number }) {
  const context = useResource(() => api<AgentContext>(`/admin/branches/${branchId}/agent-context`), [branchId]);
  const data = context.data;
  const delivery = data?.delivery;
  const fee = !delivery?.enabled ? "Deshabilitado" : delivery.fee_status === "pending_quote" ? "Por cotizar"
    : delivery.fee_status === "destination_required" ? "Según destino; requiere cotización"
    : delivery.fee === null ? "Sin importe confirmado" : amount(delivery.fee);
  return <div className="integration-column branch-agent-config">
    <div className="integration-heading"><MapPin /><div><h3>Contexto que recibirá el agente</h3><p>Solo consulta. Estos datos se configuran en el POS de esta sucursal.</p></div></div>
    {context.loading && !data && <Loading label="Consultando contexto..." />}
    {context.error && <ErrorBox message={`No se pudo actualizar el contexto. ${context.error}`} retry={() => void context.refresh()} />}
    {data && <>
      <dl className="agent-context-summary">
        <dt>Nombre del agente</dt><dd>{configured(data.agent.name)}</dd>
        <dt>Dirección</dt><dd>{configured(data.location.address)}</dd>
        <dt>Teléfono</dt><dd>{configured(data.location.phone)}</dd>
        <dt>Google Maps</dt><dd>{configured(data.location.maps_url)}</dd>
        <dt>Coordenadas de la sucursal</dt><dd>{data.location.latitude !== null && data.location.longitude !== null ? `${data.location.latitude}, ${data.location.longitude}` : "Sin configurar"}</dd>
        <dt>Número de Yape</dt><dd>{configured(data.payments.yape.number)}</dd>
        <dt>Nombre del titular</dt><dd>{configured(data.payments.yape.recipient_name)}</dd>
        <dt>QR de Yape</dt><dd>{data.payments.yape.qr_configured ? "Configurado en el POS" : "Sin configurar"}</dd>
        <dt>Número de Plin</dt><dd>{configured(data.payments.plin_number)}</dd>
        <dt>Costo de delivery</dt><dd>{fee}</dd>
        {delivery?.minimum_order_amount != null && <><dt>Compra mínima</dt><dd>{amount(delivery.minimum_order_amount)}</dd></>}
        {delivery?.free_delivery_threshold != null && <><dt>Envío gratis desde</dt><dd>{amount(delivery.free_delivery_threshold)} dentro de la cobertura configurada</dd></>}
        {delivery?.mode === "distance" && <><dt>Tarifa por distancia</dt><dd>Base {amount(delivery.distance_base_fee ?? 0)} + {amount(delivery.distance_fee_per_km ?? 0)} por km{delivery.distance_max_km !== null ? `; máximo ${delivery.distance_max_km} km` : ""}</dd></>}
      </dl>
      {delivery?.mode === "bands" && <ul>{delivery.bands.map((band) => <li key={band.id}>{band.minimum_km} a {band.maximum_km} km: {amount(band.fee)}</li>)}</ul>}
      {delivery?.mode === "neighborhoods" && <ul>{delivery.policy?.neighborhoods?.map((area) => <li key={area.name}>{area.name}: {amount(area.fee)}</li>)}</ul>}
      <p>En CLIENTES: Perfil del agente para Yape, Datos de sucursal para ubicación y Costos de envío para delivery.</p>
      <button className="button secondary" disabled={context.loading} onClick={() => void context.refresh()}>Actualizar consulta</button>
    </>}
  </div>;
}
