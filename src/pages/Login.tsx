import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useAuth } from "../lib/auth";

export function LoginPage() {
  const { signIn, signInDev, canUseDevMode, error: authError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(authError);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(null);
    try { await signIn(email, password); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo iniciar sesión."); }
    finally { setBusy(false); }
  }
  return <main className="admin-login">
    <section className="login-message"><div className="login-logo"><ShieldCheck /> Escalar AI Control</div><div><span className="eyebrow light">Gobierno multiempresa</span><h1>Control global.<br />Datos separados.</h1><p>Configura cada restaurante sin exponer credenciales, pagos ni información operativa sensible.</p></div><div className="security-stripe"><LockKeyhole /><span><strong>Autenticación centralizada</strong><small>Supabase Auth + permisos de superadmin</small></span></div></section>
    <section className="login-access"><form onSubmit={submit}><span className="eyebrow">Acceso restringido</span><h2>Administración de Escalar AI</h2><p>Solo las cuentas con rol superadmin pueden continuar.</p><label>Correo<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label><label>Contraseña<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>{error && <div className="form-error">{error}</div>}<button className="button primary large" disabled={busy}>{busy ? "Validando..." : "Ingresar"}<ArrowRight /></button>{canUseDevMode && <button type="button" className="button secondary" onClick={() => void signInDev()}><LockKeyhole /> Entorno local</button>}<small>No existen credenciales maestras dentro del frontend.</small></form></section>
  </main>;
}
