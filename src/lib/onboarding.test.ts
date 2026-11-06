import { describe, expect, it } from "vitest";
import {
  buildIntegrationPackage,
  buildDeploymentPackage,
  buildRestaurantAccessPackage,
  generateSecurePassword,
  slugifyName,
} from "./onboarding";
import type { PosNotificationsConnection, RestaurantOnboardingResult } from "../types";

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

  it("copies both scoped connections with distinct authentication in one deployment package", () => {
    const notifications = {
      credential: { business_id: 12, branch_id: 34, token: "notice-only-secret" },
      integration: { ...result.integration, profile: "generic", scopes: ["menu:read", "orders:read", "events:read", "events:deliver"] },
    } as PosNotificationsConnection;
    const packet = JSON.parse(buildDeploymentPackage(result.integration, result.credential.token, notifications)!);
    expect(packet.deployment_bundle_version).toBe(1);
    expect(packet.authentication.value).toBe(`Bearer ${result.credential.token}`);
    expect(packet.pos_notifications.authentication.value).toBe("Bearer notice-only-secret");
    expect(packet.pos_notifications.scopes).toEqual(["menu:read", "orders:read", "events:read", "events:deliver"]);
    expect(packet.pos_notifications.branch_id).toBe(34);
    expect(packet.endpoints).toEqual(result.integration.endpoints);
    expect(packet.pos_notifications).not.toHaveProperty("credential");
  });

  it("does not present a partial or cross-branch connection as a complete deployment package", () => {
    const notifications = {
      credential: { business_id: 12, branch_id: 34, token: "notice-only-secret" },
      integration: { ...result.integration },
    } as PosNotificationsConnection;
    expect(buildDeploymentPackage(result.integration, undefined, notifications)).toBeNull();
    expect(buildDeploymentPackage(result.integration, result.credential.token, null)).toBeNull();
    expect(buildDeploymentPackage(result.integration, result.credential.token, { ...notifications, credential: { ...notifications.credential, token: undefined } })).toBeNull();
    expect(buildDeploymentPackage(result.integration, result.credential.token, { ...notifications, integration: { ...notifications.integration, branch_id: 35 } })).toBeNull();
    expect(buildDeploymentPackage(result.integration, result.credential.token, { ...notifications, credential: { ...notifications.credential, business_id: 13 } })).toBeNull();
  });

  it("generates strong passwords for new restaurant users", () => {
    const password = generateSecurePassword();
    expect(password).toHaveLength(18);
    expect(password).toMatch(/[a-z]/);
    expect(password).toMatch(/[A-Z]/);
    expect(password).toMatch(/[0-9]/);
    expect(password).toMatch(/[^a-zA-Z0-9]/);
  });

  it("preserves tool contracts, lease requirements and shared schemas in the exported package", () => {
    const contract = {
      ...result.integration,
      package_version: 2,
      api_contract_version: "1.1.0",
      conversation_headers: ["X-Agent-Conversation", "X-Agent-Lease"],
      components: { schemas: { SelectionValidation: { type: "object" } } },
      endpoints: { validate_selection: { method: "POST" as const, scope: "menu:read",
        url: "https://api.escalar.test/api/v1/integrations/orders/validate-selection", read_only: true,
        idempotency: "none" as const, required_scopes: ["menu:read"], conversation_auth: "headers" as const,
        request_body: { content: { "application/json": { schema: { type: "object" } } } },
        responses: { "200": { content: { "application/json": { schema: { $ref: "#/components/schemas/SelectionValidation" } } } } } } },
    };
    const exported = JSON.parse(buildIntegrationPackage(contract));
    expect(exported.endpoints).toEqual(contract.endpoints);
    expect(exported.components).toEqual(contract.components);
    expect(exported.conversation_headers).toEqual(contract.conversation_headers);
    expect(exported.authentication.value).toBe("Bearer <TOKEN_PRIVADO>");
  });

  it("builds the credentials package with user-facing labels", () => {
    expect(buildRestaurantAccessPackage("https://pos.example", "owner@example.com", "Safe2026!Pass"))
      .toBe("Acceso a Escalar AI POS\nURL: https://pos.example\nUsuario: owner@example.com\nContraseña: Safe2026!Pass");
  });
});
