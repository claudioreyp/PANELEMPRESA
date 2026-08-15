import { describe, expect, it } from "vitest";
import {
  buildN8nEnvironment,
  buildN8nPackage,
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
  n8n: {
    api_base_url: "https://api.escalar.test/api/v1",
    business_id: 12,
    branch_id: 34,
    authentication: "bearer",
    write_idempotency_header: "Idempotency-Key",
    workflow_template: "Agente de POS Propio",
    endpoints: {
      menu: { method: "GET", url: "https://api.escalar.test/api/v1/integrations/context/menu" },
    },
  },
} as unknown as RestaurantOnboardingResult;

describe("restaurant onboarding helpers", () => {
  it("creates stable slugs for restaurant and branch names", () => {
    expect(slugifyName("Pizzería El Ñato - Lima")).toBe("pizzeria-el-nato-lima");
  });

  it("builds a complete one-time n8n package", () => {
    expect(buildN8nEnvironment(result)).toContain("ESCALAR_POS_API_TOKEN=esc_live_example.secret");
    const packageData = JSON.parse(buildN8nPackage(result));
    expect(packageData.authentication.value).toBe("Bearer esc_live_example.secret");
    expect(packageData.endpoints.menu.method).toBe("GET");
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
