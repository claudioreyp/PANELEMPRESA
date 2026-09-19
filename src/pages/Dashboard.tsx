import { ArrowUpRight, Building2, CircleDollarSign, GitBranch, ReceiptText, Store } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useResource } from "../lib/hooks";
import type { AdminMetrics, Business } from "../types";
import { Empty, ErrorBox, Loading, Money, PageHeader, Status } from "../components/ui";

export function DashboardPage() {
  const resource = useResource(async () => {
    const [metrics, businesses] = await Promise.all([api<AdminMetrics>("/admin/metrics"), api<Business[]>("/admin/businesses")]);
    return { metrics, businesses };
  });
  if (resource.loading && !resource.data) return <Loading label="Calculando operación global..." />;
  if (resource.error && !resource.data) return <ErrorBox message={resource.error} retry={() => void resource.refresh()} />;
  const metrics = resource.data!.metrics;
  const recent = resource.data!.businesses.slice(0, 6);
  return <div className="page-stack">
    <PageHeader eyebrow="Vista ejecutiva" title="La red de restaurantes, en una sola lectura." description="Métricas operativas agregadas sin revelar credenciales ni datos privados de pago." actions={<Link className="button primary" to="/negocios">Gestionar negocios <ArrowUpRight /></Link>} />
    <section className="metrics-grid"><article><span><Building2 /></span><p>Negocios</p><strong>{metrics.businesses}</strong><small>{metrics.active_businesses} activos</small></article><article><span><GitBranch /></span><p>Sucursales</p><strong>{metrics.branches}</strong><small>Configuradas en la plataforma</small></article><article><span><ReceiptText /></span><p>Pedidos hoy</p><strong>{metrics.orders_today}</strong><small>En todos los canales</small></article><article className="accent"><span><CircleDollarSign /></span><p>Ventas cerradas hoy</p><strong><Money value={metrics.sales_today} /></strong><small>Importes con impuestos incluidos</small></article></section>
    <section className="panel recent-panel"><header><div><span className="eyebrow">Actividad reciente</span><h2>Negocios incorporados</h2></div><Link to="/negocios">Ver todos <ArrowUpRight /></Link></header>{recent.length ? <div className="business-list">{recent.map((business) => <Link to={`/negocios/${business.id}`} key={business.id}><span className="business-avatar">{business.logo_url ? <img src={business.logo_url} alt="" /> : <Store />}</span><div><strong>{business.name}</strong><small>{business.slug} · POS completo</small></div><Status value={business.status} /><ArrowUpRight /></Link>)}</div> : <Empty title="Aún no hay negocios" detail="Crea el primero desde el módulo Negocios." />}</section>
  </div>;
}
