import { expect, test } from "@playwright/test";

test("superadmin login has no embedded master credentials", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Administración de Escalar AI" })).toBeVisible();
  await expect(page.getByLabel("Correo")).toHaveValue("");
  await expect(page.getByLabel("Contraseña")).toHaveValue("");
  await expect(page.getByRole("button", { name: "Entorno local" })).toHaveCount(0);
});

test("configured superadmin can authenticate", async ({ page }) => {
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  test.skip(!email || !password, "Real credentials are supplied only during secure verification.");

  await page.goto("/login");
  await page.getByLabel("Correo").fill(email!);
  await page.getByLabel("Contraseña").fill(password!);
  await page.getByRole("button", { name: "Ingresar" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", { name: "La red de restaurantes, en una sola lectura." }),
  ).toBeVisible();
  await expect(page.getByText(email!, { exact: true })).toBeVisible();
});
