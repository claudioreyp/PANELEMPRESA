import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { IntegrationPackage, PosNotificationsConnection } from "../types";
import { IntegrationPackageView } from "./IntegrationPackageView";

const integration: IntegrationPackage = {
  profile: "restaurant_agent", api_base_url: "https://api.example.test/api/v1", business_id: 12, branch_id: 34,
  authentication: "bearer", authorization_header: "Authorization", write_idempotency_header: "Idempotency-Key",
  scopes: ["menu:read", "orders:read"], endpoints: {},
};
const notifications = {
  credential: { business_id: 12, branch_id: 34, token: "notice-only-secret" },
  integration: { ...integration, profile: "generic", scopes: ["menu:read", "orders:read", "events:read", "events:deliver"] },
} as PosNotificationsConnection;
afterEach(cleanup);

it("offers one complete copy action containing both credentials", () => {
  const copy = vi.fn().mockResolvedValue(undefined);
  render(<IntegrationPackageView integration={integration} token="agent-only-secret" posNotifications={notifications} completeDeployment copy={copy} />);
  fireEvent.click(screen.getByRole("button", { name: "Copiar paquete completo para n8n" }));
  expect(copy).toHaveBeenCalledTimes(1);
  const payload = JSON.parse(copy.mock.calls[0][0]);
  expect(payload.authentication.value).toBe("Bearer agent-only-secret");
  expect(payload.pos_notifications.authentication.value).toBe("Bearer notice-only-secret");
  expect(screen.queryByRole("button", { name: "Copiar paquete de APIs" })).not.toBeInTheDocument();
});

it("disables the complete copy action when the response omits the second secret", () => {
  const copy = vi.fn();
  render(<IntegrationPackageView integration={integration} token="agent-only-secret" completeDeployment copy={copy} />);
  const button = screen.getByRole("button", { name: "Copiar paquete completo para n8n" });
  expect(button).toBeDisabled();
  fireEvent.click(button);
  expect(copy).not.toHaveBeenCalled();
  expect(screen.getByText(/no se emitirán otras credenciales automáticamente/)).toBeVisible();
});

it("preserves the existing metadata-only package action outside new onboarding", () => {
  const copy = vi.fn().mockResolvedValue(undefined);
  render(<IntegrationPackageView integration={integration} copy={copy} />);
  fireEvent.click(screen.getByRole("button", { name: "Copiar paquete de APIs" }));
  const payload = JSON.parse(copy.mock.calls[0][0]);
  expect(payload.authentication.value).toBe("Bearer <TOKEN_PRIVADO>");
  expect(payload).not.toHaveProperty("deployment_bundle_version");
  expect(payload).not.toHaveProperty("pos_notifications");
});
