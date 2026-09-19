import { describe, expect, it } from "vitest";
import { friendlyAuthError } from "./auth-errors";

describe("admin authentication errors", () => {
  it.each([
    new TypeError("Failed to fetch"),
    new TypeError("Load failed"),
    new TypeError("NetworkError when attempting to fetch resource."),
    { name: "AuthRetryableFetchError", message: "provider unavailable", status: 0 },
    { message: "provider unavailable", status: 503 },
  ])("explains an unavailable provider without exposing technical details: %o", (error) => {
    expect(friendlyAuthError(error)).toBe("No pudimos conectar con el servicio de acceso. Revisa la conexión y que el proyecto de Supabase esté activo.");
  });

  it.each([
    [new Error("Invalid login credentials"), "Correo o contraseña incorrectos."],
    [{ code: "invalid_credentials", status: 400 }, "Correo o contraseña incorrectos."],
    [{ code: "email_not_confirmed" }, "Confirma tu correo antes de ingresar."],
    [{ status: 429 }, "Hubo demasiados intentos. Espera un momento y vuelve a probar."],
    [new Error("internal auth detail"), "No pudimos iniciar sesión. Inténtalo nuevamente."],
  ])("keeps a safe, specific explanation for %o", (error, message) => {
    expect(friendlyAuthError(error)).toBe(message);
  });
});
