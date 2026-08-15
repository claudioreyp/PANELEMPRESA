import { MailCheck, RefreshCcw } from "lucide-react";
import { api } from "../lib/api";
import { useResource } from "../lib/hooks";
import type { Business, Invitation } from "../types";
import { Empty, ErrorBox, Loading, PageHeader, Status } from "../components/ui";

export function InvitationsPage() {
  const resource = useResource(async () => {
    const [invitations, businesses] = await Promise.all([api<Invitation[]>("/admin/invitations"), api<Business[]>("/admin/businesses")]);
    return { invitations, businesses };
  });
  if (resource.loading && !resource.data) return <Loading />;
  if (resource.error && !resource.data) return <ErrorBox message={resource.error} retry={() => void resource.refresh()} />;
  const data = resource.data!;
  return <div className="page-stack"><PageHeader eyebrow="Identidades" title="Invitaciones y altas" description="Seguimiento de enlaces de acceso sin contraseñas temporales ni secretos visibles." actions={<button className="button secondary" onClick={() => void resource.refresh()}><RefreshCcw /> Actualizar</button>} />
    <section className="panel"><header><div><span className="eyebrow">Últimos 300 registros</span><h2>Historial de invitaciones</h2></div><MailCheck /></header>{data.invitations.length ? <div className="responsive-table"><table><thead><tr><th>Correo</th><th>Negocio</th><th>Rol</th><th>Estado</th><th>Creada</th><th>Vence</th></tr></thead><tbody>{data.invitations.map((item) => <tr key={item.id}><td><strong>{item.email}</strong></td><td>{data.businesses.find((business) => business.id === item.business_id)?.name || `#${item.business_id}`}</td><td>{item.role}</td><td><Status value={item.status} /></td><td>{new Date(item.created_at).toLocaleDateString("es-PE")}</td><td>{new Date(item.expires_at).toLocaleDateString("es-PE")}</td></tr>)}</tbody></table></div> : <Empty title="No hay invitaciones" detail="Se crean desde cada negocio para asignar el ámbito correcto." />}</section>
  </div>;
}
