import { expect, test } from "@playwright/test";

for (const width of [1440, 390]) {
  test(`additional credential is scoped, shown once and reconciled at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 950 });
    await page.addInitScript(() => localStorage.setItem("impulsa.adminAuthMode", "dev"));
    const branch = { id: 2, business_id: 2, name: "Principal de prueba", slug: "main", active: true };
    const credential = { id: 91, business_id: 2, branch_id: 2, name: "Agente de prueba", token_prefix: "test_prefix", scopes: ["menu:read"], active: true };
    const integration = { business_id: 2, branch_id: 2, api_base_url: "https://api.example.test/api/v1", scopes: ["menu:read"], endpoints: {} };
    let posts = 0;
    let loseResponse = false;
    await page.route("**/api/v1/**", async route => {
      const url = new URL(route.request().url());
      const path = url.pathname.replace("/api/v1", "");
      let body: unknown = [];
      if (path === "/me") body = { role: "superadmin", user_id: "isolated-admin" };
      else if (path.endsWith("/overview")) body = { business: { id: 2, name: "Pizza House de prueba", status: "active", modules: {} }, branches: 1, users: 0, orders: 0, sales: 0 };
      else if (path === "/branches") body = [branch];
      else if (path === "/admin/integration-credentials" && route.request().method() === "POST") {
        posts++;
        const request = route.request().postDataJSON();
        expect(request.branch_id).toBe(2);
        expect(request.scopes).not.toContain("inventory:write");
        expect(route.request().headers()["idempotency-key"]).toBeTruthy();
        if (loseResponse) return route.abort("failed");
        body = { ...credential, token: "isolated-test-secret", secret_available: true };
      } else if (path.includes("/operations/")) body = { status: "created", credential };
      else if (path.endsWith("/integration")) {
        expect(url.searchParams.get("credential_id")).toBe("91");
        body = { integration, credential };
      } else if (path.endsWith("/agent-context")) body = { agent: {}, location: {}, payments: { yape: {} }, delivery: {} };
      await route.fulfill({ json: body });
    });
    await page.goto("/negocios/2");
    const form = page.locator(".credential-create");
    await expect(form.getByRole("heading", { name: "Crear credencial adicional" })).toBeVisible();
    await form.getByLabel("Nombre de la credencial").fill("Agente de prueba");
    await form.scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath(`credential-form-${width}.png`), fullPage: true });
    await form.getByRole("button", { name: "Crear credencial adicional", exact: true }).click();
    await expect(form.getByText("isolated-test-secret", { exact: true })).toBeVisible();
    expect(posts).toBe(1);
    expect(await page.evaluate(() => JSON.stringify(localStorage) + JSON.stringify(sessionStorage))).not.toContain("isolated-test-secret");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`credential-result-${width}.png`), fullPage: true });
    page.on("dialog", dialog => dialog.accept());
    await form.getByRole("button", { name: "Cerrar resultado" }).click();
    await expect(form.getByText("isolated-test-secret", { exact: true })).toHaveCount(0);
    loseResponse = true;
    await form.getByRole("button", { name: "Crear credencial adicional", exact: true }).click();
    await form.getByRole("button", { name: "Consultar resultado" }).click();
    await expect(form.getByText("La emisión está confirmada, pero el token no pudo recuperarse.", { exact: false })).toBeVisible();
    expect(posts).toBe(2);
  });
}
