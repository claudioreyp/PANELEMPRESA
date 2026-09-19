import { expect, test, type Page } from "@playwright/test";

const business = { id: 11, name: "Restaurante de prueba", slug: "restaurante-de-prueba", status: "active", plan: "pos", modules: { pos: true, tables: true }, currency: "PEN" };
const branch = { id: 21, business_id: 11, name: "Principal", slug: "principal", active: true, accepted_payment_methods: ["cash"], delivery_fee: 0 };
const credential = { id: 31, business_id: 11, branch_id: 21, name: "Integración principal", token_prefix: "esc_test", scopes: ["menu:read"], active: true, last_used_at: null };
const integration = { api_base_url: "https://api.example.test/api/v1", business_id: 11, branch_id: 21, authentication: "bearer", authorization_header: "Authorization", write_idempotency_header: "Idempotency-Key", scopes: ["menu:read"], endpoints: { menu: { method: "GET", scope: "menu:read", url: "https://api.example.test/api/v1/integrations/context/menu" } } };

async function setup(page: Page, lost = false) {
  let creations = 0;
  await page.addInitScript(() => localStorage.setItem("impulsa.adminAuthMode", "dev"));
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/v1", "");
    let body: unknown = [];
    if (path === "/me") body = { role: "superadmin", user_id: "test-admin" };
    else if (path === "/admin/businesses") body = creations ? [business] : [];
    else if (path === "/admin/onboarding/restaurants" && route.request().method() === "POST") {
      creations++;
      if (lost) return route.abort("failed");
      await new Promise((resolve) => setTimeout(resolve, 300));
      body = { business, branch, owner_access: { email: "owner@example.test" }, credential: { ...credential, token: "test-only-token" }, integration };
    } else if (path === "/admin/onboarding/restaurants/status") body = { status: "created", business };
    else if (path.endsWith("/overview")) body = { business, branches: 1, users: 1, orders: 0, sales: 0 };
    else if (path === "/branches") body = [branch];
    else if (path === "/admin/integration-credentials") body = [credential];
    else if (path.endsWith("/integration")) body = { integration, credential };
    await route.fulfill({ json: body });
  });
  return { creations: () => creations };
}

async function fillRestaurant(page: Page) {
  await page.goto("/negocios");
  await page.getByRole("button", { name: "Nuevo restaurante" }).click();
  await page.getByLabel("Nombre", { exact: true }).fill(business.name);
  await page.getByLabel("Nombre del propietario").fill("Propietario de prueba");
  await page.getByLabel("Usuario (correo)").fill("owner@example.test");
}

test("full POS onboarding exposes only generic API data and one-time secrets", async ({ page }, info) => {
  const mock = await setup(page);
  await fillRestaurant(page);
  await expect(page.getByLabel("Plan", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Crear restaurante y APIs" }).dblclick();
  await expect(page.getByText("Restaurante de prueba está listo", { exact: true })).toBeVisible();
  expect(mock.creations()).toBe(1);
  await expect(page.getByRole("heading", { name: "APIs privadas del restaurante" })).toBeVisible();
  await expect(page.getByText("Usuario y contraseña de CLIENTES", { exact: true })).toBeVisible();
  expect(await page.locator("body").innerText()).not.toMatch(/n8n|workflow|superpro|básico/i);
  expect(await page.evaluate(() => JSON.stringify(localStorage) + JSON.stringify(sessionStorage))).not.toContain("test-only-token");
  await page.screenshot({ path: `test-results/onboarding-${info.project.name}.png`, fullPage: true });
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Ya guardé el acceso y las APIs, cerrar" }).click();
  await page.goto("/negocios/11");
  await page.getByRole("button", { name: "Ver APIs", exact: true }).click();
  await expect(page.getByText("El token no puede recuperarse.", { exact: false })).toBeVisible();
  await expect(page.getByText("test-only-token", { exact: true })).toHaveCount(0);
});

test("lost onboarding response is reconciled without another creation", async ({ page }) => {
  const mock = await setup(page, true);
  await fillRestaurant(page);
  await page.getByRole("button", { name: "Crear restaurante y APIs" }).click();
  await expect(page.getByRole("button", { name: "Consultar estado del alta" })).toBeVisible();
  await page.getByRole("button", { name: "Consultar estado del alta" }).click();
  await expect(page.getByRole("link", { name: "Abrir restaurante existente" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Crear restaurante y APIs" })).toBeDisabled();
  expect(mock.creations()).toBe(1);
});
