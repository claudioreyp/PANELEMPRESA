import { describe, expect, it } from "vitest";
import {
  buildIntegrationPackage,
  buildRestaurantAccessPackage,
  generateSecurePassword,
  slugifyName,
} from "./onboarding";
import type { RestaurantOnboardingResult } from "../types";

const result = {
  business: { id: 12 },
  branch: { id: 34 },
  owner_access: {},
  credential: { token: "esc_live_example.secret", scopes: ["menu:read", "orders:write"] },
  integration: {
    api_base_url: "https://api.escalar.test/api/v1",
    business_id: 12,
    branch_id: 34,
    authentication: "bearer",
    write_idempotency_header: "Idempotency-Key",
    authorization_header: "Authorization",
    scopes: ["menu:read", "orders:write"],
    endpoints: {
      menu: { method: "GET", url: "https://api.escalar.test/api/v1/integrations/context/menu" },
      customer_catalog: { method: "GET", url: "https://api.escalar.test/api/v1/integrations/context/catalog", scope: "menu:read" },
      preview_order: { method: "POST", url: "https://api.escalar.test/api/v1/integrations/orders/preview", scope: "orders:write" },
    },
  },
} as unknown as RestaurantOnboardingResult;

describe("restaurant onboarding helpers", () => {
  it("creates stable slugs for restaurant and branch names", () => {
    expect(slugifyName("Pizzería El Ñato - Lima")).toBe("pizzeria-el-nato-lima");
  });

  it("builds a generic one-time API package", () => {
    const packageData = JSON.parse(buildIntegrationPackage(result.integration, result.credential.token));
    expect(packageData.authentication.value).toBe("Bearer esc_live_example.secret");
    expect(packageData.endpoints.menu.method).toBe("GET");
    expect(packageData.endpoints.customer_catalog.scope).toBe("menu:read");
    expect(packageData.endpoints.preview_order.url).toBe("https://api.escalar.test/api/v1/integrations/orders/preview");
    expect(packageData.business_id).toBe(12);
    expect(packageData.branch_id).toBe(34);
    expect(packageData).not.toHaveProperty("environment");
    expect(buildIntegrationPackage(result.integration)).not.toContain(result.credential.token);
  });

  it("generates strong passwords for new restaurant users", () => {
    const password = generateSecurePassword();
    expect(password).toHaveLength(18);
    expect(password).toMatch(/[a-z]/);
    expect(password).toMatch(/[A-Z]/);
    expect(password).toMatch(/[0-9]/);
    expect(password).toMatch(/[^a-zA-Z0-9]/);
  });

  it("builds the credentials package with user-facing labels", () => {
    expect(buildRestaurantAccessPackage("https://pos.example", "owner@example.com", "Safe2026!Pass"))
      .toBe("Acceso a Escalar AI POS\nURL: https://pos.example\nUsuario: owner@example.com\nContraseña: Safe2026!Pass");
  });
});
