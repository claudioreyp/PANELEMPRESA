import { Activity, RefreshCcw } from "lucide-react";
import { api } from "../lib/api";
import { useResource } from "../lib/hooks";
import type { AuditEvent, Business } from "../types";
import { Empty, ErrorBox, Loading, PageHeader } from "../components/ui";

export function AuditPage() {
  const resource = useResource(async () => {
    const [events, businesses] = await Promise.all([api<AuditEvent[]>("/admin/audit?limit=300"), api<Business[]>("/admin/businesses")]);
    return { events, businesses };
  });
  if (resource.loading && !resource.data) return <Loading label="Leyendo trazabilidad..." />;
  if (resource.error && !resource.data) return <ErrorBox message={resource.error} retry={() => void resource.refresh()} />;
  const data = resource.data!;
  return <div className="page-stack"><PageHeader eyebrow="Trazabilidad" title="Auditoría administrativa" description="Registro inmutable de cambios críticos, accesos y configuraciones." actions={<button className="button secondary" onClick={() => void resource.refresh()}><RefreshCcw /> Actualizar</button>} />
    <section className="audit-timeline">{data.events.length ? data.events.map((event) => <article key={event.id}><span><Activity /></span><div><header><strong>{event.action.replaceAll(".", " · ")}</strong><time>{new Date(event.created_at).toLocaleString("es-PE")}</time></header><p>{event.entity_type} {event.entity_id ? `#${event.entity_id}` : ""} · {data.businesses.find((business) => business.id === event.business_id)?.name || "Plataforma"}</p><small>Actor: {event.actor_id || "sistema"}</small></div></article>) : <Empty title="Aún no hay eventos" detail="Los cambios administrativos aparecerán aquí." />}</section>
  </div>;
}
