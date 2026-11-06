import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api } from "../lib/api";
import { deploymentProfile, deploymentScopes, type DeploymentRole } from "../lib/existingDeployment";
import type { Branch, IntegrationCredential, IntegrationPackage } from "../types";
import { ExistingDeploymentPackage } from "./ExistingDeploymentPackage";

vi.mock("../lib/api", async importOriginal => ({ ...await importOriginal<typeof import("../lib/api")>(), api: vi.fn() }));
const mocked = vi.mocked(api), copy = vi.fn().mockResolvedValue(undefined), onCreated = vi.fn();
const branch = { id: 21, business_id: 11, name: "Principal" } as Branch;
function fixture(role: DeploymentRole) {
  const credential = {
    id: role === "agent" ? 31 : 32, business_id: 11, branch_id: 21, profile: deploymentProfile(role),
    name: role === "agent" ? "Agente existente" : "Avisos existentes", active: true,
    token_prefix: `esc_live_${role}TestOnly`, scopes: deploymentScopes[role], expires_at: null, revoked_at: null,
  } as IntegrationCredential;
  const integration = {
    business_id: 11, branch_id: 21, profile: credential.profile, api_base_url: "https://api.escalarai.tech/api/v1",
    scopes: credential.scopes, authentication: "bearer", authorization_header: "Authorization", write_idempotency_header: "Idempotency-Key", endpoints: {},
  } as IntegrationPackage;
  const token = `${credential.token_prefix}.syntheticSecretOnly0123456789`;
  return { credential, integration, token };
}
const a = fixture("agent"), n = fixture("notices");
beforeEach(() => {
  mocked.mockReset(); copy.mockClear(); onCreated.mockClear();
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: copy } });
  mocked.mockImplementation(async path => String(path).includes("credential_id=31") ? a : n);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function open(credentials = [a.credential, n.credential]) {
  const view = render(<ExistingDeploymentPackage branch={branch} businessName="Panpo de ensayo" credentials={credentials} onCreated={onCreated} />);
  fireEvent.click(screen.getByRole("button", { name: "Copiar paquete completo para n8n" })); return view;
}

it("prepares saved credentials, rechecks before copy and stores neither token in browser storage", async () => {
  open();
  fireEvent.change(screen.getByLabelText("Token del agente"), { target: { value: a.token } });
  fireEvent.change(screen.getByLabelText("Token de avisos del POS"), { target: { value: n.token } });
  const button = screen.getByRole("button", { name: "Copiar paquete completo para n8n" });
  await waitFor(() => expect(button).toBeEnabled()); fireEvent.click(button);
  await waitFor(() => expect(copy).toHaveBeenCalledTimes(1));
  expect(mocked.mock.calls).toHaveLength(4); expect(mocked.mock.calls.every(call => !call[1]?.method)).toBe(true);
  const packet = JSON.parse(copy.mock.calls[0][0]);
  expect(packet.authentication.value).toBe(`Bearer ${a.token}`); expect(packet.pos_notifications.authentication.value).toBe(`Bearer ${n.token}`);
  expect(JSON.stringify(localStorage) + JSON.stringify(sessionStorage)).not.toContain("syntheticSecretOnly");
  expect(screen.getByLabelText("Token del agente")).toHaveAttribute("type", "password");
});

it("blocks copy after the selected credential was rotated or revoked", async () => {
  open();
  fireEvent.change(screen.getByLabelText("Token del agente"), { target: { value: a.token } });
  fireEvent.change(screen.getByLabelText("Token de avisos del POS"), { target: { value: n.token } });
  const button = screen.getByRole("button", { name: "Copiar paquete completo para n8n" });
  await waitFor(() => expect(button).toBeEnabled());
  mocked.mockImplementation(async path => String(path).includes("credential_id=31") ? { ...a, credential: { ...a.credential, token_prefix: "esc_live_rotated" } } : n);
  fireEvent.click(button); await screen.findByRole("alert"); expect(copy).not.toHaveBeenCalled();
});

it("creates nothing on opening, and unknown additional issuance cannot be repeated", async () => {
  open([]); expect(mocked).not.toHaveBeenCalled();
  const group = within(screen.getByRole("group", { name: "Conexión del agente" }));
  mocked.mockRejectedValueOnce(new TypeError("network"));
  act(() => { const button = group.getByRole("button", { name: "Crear credencial del agente" }); fireEvent.click(button); fireEvent.click(button); });
  await group.findByText(/No pudimos confirmar/);
  expect(mocked.mock.calls.filter(call => call[1]?.method === "POST")).toHaveLength(1);
  expect(group.queryByRole("button", { name: "Crear credencial del agente" })).not.toBeInTheDocument();
  mocked.mockResolvedValueOnce({ status: "created", credential: a.credential }).mockResolvedValueOnce(a);
  fireEvent.click(group.getByRole("button", { name: "Consultar resultado" }));
  await group.findByText(/La emisión está confirmada/);
  expect(screen.getByRole("button", { name: "Copiar paquete completo para n8n" })).toBeDisabled();
  expect(mocked.mock.calls.filter(call => call[1]?.method === "POST")).toHaveLength(1);
});

it("keeps a newly issued secret and retries only the failed contract GET", async () => {
  open([]);
  mocked.mockResolvedValueOnce({ ...a.credential, token: a.token }).mockRejectedValueOnce(new Error("GET failed"));
  const group = within(screen.getByRole("group", { name: "Conexión del agente" }));
  fireEvent.click(group.getByRole("button", { name: "Crear credencial del agente" }));
  await group.findByText(/No pudimos cargar las rutas/); expect(group.getByText(a.token)).toBeVisible();
  mocked.mockResolvedValueOnce(a); fireEvent.click(group.getByRole("button", { name: "Volver a consultar APIs" }));
  await group.findByText("Conexión preparada para el paquete completo.");
  expect(mocked.mock.calls.filter(call => call[1]?.method === "POST")).toHaveLength(1);
  expect(mocked.mock.calls.filter(call => !call[1]?.method)).toHaveLength(2);
});

it("does not adopt a late contract from a previous branch", async () => {
  let resolve!: (value: unknown) => void;
  mocked.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  const view = open([a.credential]);
  view.rerender(<ExistingDeploymentPackage key={22} branch={{ ...branch, id: 22 }} businessName="Otra sede" credentials={[]} onCreated={onCreated} />);
  await act(async () => resolve(a));
  expect(copy).not.toHaveBeenCalled(); expect(screen.queryByLabelText("Token del agente")).not.toBeInTheDocument();
});
