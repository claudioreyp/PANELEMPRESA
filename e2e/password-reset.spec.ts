import { expect, test } from "@playwright/test";

test("owner password renewal preserves Admins appearance and reconciles lost responses", async ({ page }, info) => {
  let writes = 0;
  const business = { id: 11, name: "Restaurante de prueba", slug: "prueba", status: "active", timezone: "America/Lima", currency: "PEN" };
  await page.addInitScript(() => localStorage.setItem("impulsa.adminAuthMode", "dev"));
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = [];
    if (path.endsWith("/me")) body = { role: "superadmin", user_id: "test-admin" };
    else if (path.endsWith("/overview")) body = { business, branches: 1, users: 2, orders: 0, sales: 0 };
    else if (path.endsWith("/memberships")) body = [
      { id: 4, business_id: 11, role: "owner", full_name: "Propietario", email: "owner@example.test", active: true, can_reset_password: true, password_security_version: 0 },
      { id: 5, business_id: 11, role: "cashier", full_name: "Empleado", active: true, can_reset_password: false },
    ];
    else if (path.endsWith("/password-reset")) { writes++; return route.abort("failed"); }
    else if (path.endsWith("/password-reset/lookup")) body = { status: "succeeded", operation_id: "op", security_version: 1, client_pos_url: "https://pos.example.test" };
    await route.fulfill({ json: body });
  });
  await page.goto("/negocios/11");
  await expect(page.getByRole("button", { name: "Renovar contraseña", exact: true })).toHaveCount(1);
  await page.getByRole("button", { name: "Renovar contraseña", exact: true }).click();
  await page.getByRole("button", { name: "Generar contraseña", exact: true }).click();
  await page.screenshot({ path: `test-results/password-reset-${info.project.name}.png` });
  const box = await page.getByRole("dialog").boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.getByRole("button", { name: "Renovar contraseña y cerrar sesiones" }).click();
  await page.getByRole("button", { name: "Consultar resultado" }).click();
  await expect(page.getByText("Contraseña renovada", { exact: true })).toBeVisible();
  expect(writes).toBe(1);
  const stored = await page.evaluate(() => JSON.stringify(localStorage) + JSON.stringify(sessionStorage));
  expect(stored).not.toContain("owner@example.test");
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
