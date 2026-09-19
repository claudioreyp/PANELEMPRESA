import { Copy, Eye, EyeOff, RefreshCw, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, ApiError } from "../lib/api";
import { buildRestaurantAccessPackage, generateSecurePassword } from "../lib/onboarding";
import type { Membership } from "../types";
import { OnboardingDialog } from "./OnboardingDialog";

type Result = { operation_id: string | null; status: "pending" | "succeeded" | "failed" | "unconfirmed"; security_version?: number; client_pos_url?: string };

export function PasswordResetDialog({ member, onClose, onUpdated }: {
  member: Membership; onClose: () => void; onUpdated: () => void;
}) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<Result | null>(member.password_reset_operation_id
    ? { operation_id: member.password_reset_operation_id, status: "pending" } : null);
  const version = useRef(member.password_security_version || 0);
  const key = useRef<string | null>(null);
  const working = useRef(false);
  const mounted = useRef(true);
  const path = `/admin/businesses/${member.business_id}/memberships/${member.id}/password-reset`;
  const pending = result?.status === "pending" || result?.status === "unconfirmed";
  const completed = result?.status === "succeeded";

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; key.current = null; }; }, []);
  useEffect(() => {
    if (!password && !pending && !busy) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [password, pending, busy]);

  function close() {
    if (working.current) return;
    if ((password || pending) && !window.confirm(pending
      ? "La renovación sigue pendiente. Podrás consultar su estado al volver, pero la contraseña se borrará de esta pantalla. ¿Cerrar?"
      : "La contraseña no se podrá recuperar después de cerrar. ¿Cerrar este recuadro?")) return;
    setPassword(""); setConfirmation(""); key.current = null; onClose();
  }

  function receive(value: Result) {
    if (!mounted.current) return;
    setResult(value);
    if (value.security_version !== undefined) version.current = value.security_version;
    if (value.status === "failed") {
      key.current = null;
      setMessage("El servicio rechazó la renovación. Revisa la contraseña y vuelve a intentarlo.");
    } else setMessage("");
    onUpdated();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (working.current || pending || completed) return;
    if (password !== confirmation) { setMessage("Las contraseñas no coinciden."); return; }
    if (password.length < 12 || password.length > 128 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^a-zA-Z0-9\s]/.test(password)) {
      setMessage("Usa 12 a 128 caracteres con mayúscula, minúscula, número y símbolo."); return;
    }
    working.current = true; setBusy(true); setMessage("");
    key.current = crypto.randomUUID();
    try {
      receive(await api<Result>(path, { method: "POST", headers: { "Idempotency-Key": key.current },
        body: JSON.stringify({ password, expected_version: version.current }) }));
    } catch (caught) {
      if (!mounted.current) return;
      if (caught instanceof ApiError && [400, 401, 403, 404, 409, 422].includes(caught.status)) {
        setMessage(caught.message); key.current = null; onUpdated();
      } else {
        setResult({ operation_id: null, status: "unconfirmed" });
        setMessage("No se pudo confirmar el resultado. Consulta el estado antes de intentar otra renovación.");
      }
    } finally { working.current = false; if (mounted.current) setBusy(false); }
  }

  async function check() {
    if (working.current) return;
    working.current = true; setBusy(true);
    try {
      const suffix = result?.operation_id || "lookup";
      receive(await api<Result>(`${path}/${suffix}`, { headers: key.current ? { "Idempotency-Key": key.current } : {} }));
    } catch { if (mounted.current) setMessage("No pudimos comprobar el resultado. La renovación no se repetirá; vuelve a consultar."); }
    finally { working.current = false; if (mounted.current) setBusy(false); }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(buildRestaurantAccessPackage(result!.client_pos_url!, member.email!, password));
      if (mounted.current) setMessage("Acceso copiado. Compártelo únicamente con el propietario.");
    } catch { if (mounted.current) setMessage("No se pudo copiar. Selecciona los datos mostrados para copiarlos."); }
  }

  return <OnboardingDialog label="Renovar contraseña" className="password-reset-modal" onClose={close}>
    <header><div><h2>Renovar contraseña</h2><p>{member.full_name}<br />{member.email}</p></div><button type="button" aria-label="Cerrar" disabled={busy} onClick={close}><X /></button></header>
    {completed ? <div className="form-stack" role="status"><h3>Contraseña renovada</h3><p>El propietario debe volver a ingresar en CLIENTES. Sus permisos y los datos del negocio no cambiaron.</p>
      {password && result?.client_pos_url ? <><label>Contraseña nueva<input value={password} readOnly type={visible ? "text" : "password"} autoComplete="off" /></label><button className="button secondary" type="button" onClick={() => setVisible(!visible)}>{visible ? <EyeOff /> : <Eye />}{visible ? "Ocultar contraseña" : "Mostrar contraseña"}</button><button type="button" className="button primary" onClick={() => void copy()}><Copy /> Copiar acceso a CLIENTES</button></>
        : <p>Esta pantalla ya no conserva la contraseña. Si no la guardaste, cierra el recuadro y realiza una nueva renovación.</p>}
    </div> : pending ? <div className="form-stack" role="status"><h3>Confirmación pendiente</h3><p>No vuelvas a enviar otra contraseña. Estamos comprobando si el servicio completó esta solicitud. El acceso del propietario permanecerá bloqueado mientras se resuelve.</p><button className="button secondary" disabled={busy} onClick={() => void check()}><RefreshCw />{busy ? "Consultando…" : "Consultar resultado"}</button></div>
      : <form className="form-stack" onSubmit={(event) => void submit(event)}>
        <p>Se cerrarán las sesiones de esta cuenta en la web y la app instalada. No afecta los PIN de empleados ni las credenciales de integración.</p>
        {(member.identity_business_count || 0) > 1 && <p role="note">Esta identidad pertenece a {member.identity_business_count} negocios. La nueva contraseña se usará en todos ellos.</p>}
        <label>Nueva contraseña<div className="password-input-row"><input value={password} onChange={(event) => setPassword(event.target.value)} type={visible ? "text" : "password"} autoComplete="new-password" minLength={12} maxLength={128} required disabled={busy} /><button type="button" disabled={busy} aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"} onClick={() => setVisible(!visible)}>{visible ? <EyeOff /> : <Eye />}</button><button type="button" disabled={busy} aria-label="Generar contraseña" onClick={() => { const generated = generateSecurePassword(); setPassword(generated); setConfirmation(generated); }}><RefreshCw /></button></div><small>12 a 128 caracteres, con mayúscula, minúscula, número y símbolo.</small></label>
        <label>Confirmar contraseña<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} type={visible ? "text" : "password"} autoComplete="new-password" required disabled={busy} /></label>
        <button className="button primary" disabled={busy}>{busy ? "Renovando…" : "Renovar contraseña y cerrar sesiones"}</button>
      </form>}
    {message && <p role="status">{message}</p>}
  </OnboardingDialog>;
}
