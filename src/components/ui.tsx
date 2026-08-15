import { AlertTriangle, CheckCircle2, LoaderCircle, X } from "lucide-react";
import type { ReactNode } from "react";

export function Money({ value }: { value: number }) {
  return <>{new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(value)}</>;
}

export function Status({ value }: { value: string }) {
  return <span className={`status status-${value}`}>{value.replaceAll("_", " ")}</span>;
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description?: string; actions?: ReactNode }) {
  return <header className="page-header"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="page-actions">{actions}</div>}</header>;
}

export function Loading({ label = "Cargando..." }: { label?: string }) {
  return <div className="state-box"><LoaderCircle className="spin" /><span>{label}</span></div>;
}

export function ErrorBox({ message, retry }: { message: string; retry?: () => void }) {
  return <div className="state-box error-box"><AlertTriangle /><span>{message}</span>{retry && <button className="button secondary" onClick={retry}>Reintentar</button>}</div>;
}

export function Empty({ title, detail }: { title: string; detail: string }) {
  return <div className="empty"><strong>{title}</strong><p>{detail}</p></div>;
}

export function Toast({ message, tone, onClose }: { message: string; tone: "success" | "error"; onClose: () => void }) {
  return <div className={`toast ${tone}`} role="status">{tone === "success" ? <CheckCircle2 /> : <AlertTriangle />}<span>{message}</span><button onClick={onClose}><X /></button></div>;
}
