export function friendlyAuthError(error: unknown): string {
  const details: { name?: unknown; message?: unknown; code?: unknown; status?: unknown } =
    error && typeof error === "object" ? error : { message: error };
  const message = typeof details.message === "string" ? details.message : "";
  if (details.name === "AuthRetryableFetchError"
    || details.status === 0
    || (typeof details.status === "number" && details.status >= 500 && details.status < 600)
    || /failed to fetch|fetch failed|load failed|networkerror|network request failed/i.test(message)) {
    return "No pudimos conectar con el servicio de acceso. Revisa la conexión y que el proyecto de Supabase esté activo.";
  }
  if (details.code === "invalid_credentials" || /invalid login credentials/i.test(message)) {
    return "Correo o contraseña incorrectos.";
  }
  if (details.code === "email_not_confirmed" || /email not confirmed/i.test(message)) {
    return "Confirma tu correo antes de ingresar.";
  }
  if (details.status === 429 || /rate limit|too many requests/i.test(message)) {
    return "Hubo demasiados intentos. Espera un momento y vuelve a probar.";
  }
  return "No pudimos iniciar sesión. Inténtalo nuevamente.";
}
