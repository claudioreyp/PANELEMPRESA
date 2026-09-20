import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api } from "../lib/api";
import type { Branch } from "../types";
import { CredentialCreate } from "./CredentialCreate";

vi.mock("../lib/api", async importOriginal => ({ ...await importOriginal<typeof import("../lib/api")>(), api: vi.fn() }));
const mocked = vi.mocked(api);
const branch = { id: 2, business_id: 2, name: "Sucursal principal" } as Branch;
const issued = { id: 9, business_id: 2, branch_id: 2, name: "Adicional", scopes: ["menu:read"], token: "test-only-secret", token_prefix: "test-prefix", secret_available: true };
const integration = { api_base_url: "https://api.example.test/api/v1", business_id: 2, branch_id: 2, authentication: "bearer", authorization_header: "Authorization", scopes: ["menu:read"], endpoints: {} };
const copy = vi.fn().mockResolvedValue(undefined);
const onCreated = vi.fn();
beforeEach(() => {
  vi.clearAllMocks(); mocked.mockReset();
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: copy } });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function open(key = 2) { return render(<CredentialCreate key={key} branch={branch} businessName="Pizza House" onCreated={onCreated} />); }
function create() { fireEvent.click(screen.getByRole("button", { name: "Crear credencial adicional" })); }

it("shows the scope, excludes inventory writes and copies the matching secret package", async () => {
  mocked.mockResolvedValueOnce(issued).mockResolvedValueOnce({ integration });
  open(); create();
  fireEvent.click(await screen.findByRole("button", { name: "Copiar paquete de APIs" }));
  await waitFor(() => expect(copy).toHaveBeenCalled());
  const payload = JSON.parse(copy.mock.calls[0][0]);
  expect(payload.authentication.value).toBe(`Bearer ${issued.token}`);
  expect(payload.branch_id).toBe(2);
  const options = mocked.mock.calls[0][1]!;
  expect((options.headers as Record<string, string>)["Idempotency-Key"]).toBeTruthy();
  expect(JSON.parse(options.body as string).scopes).not.toContain("inventory:write");
  expect(mocked.mock.calls[1][0]).toContain("credential_id=9");
  expect(onCreated).toHaveBeenCalledTimes(1);
});

it("blocks double clicks and resolves a lost response without another issuance", async () => {
  mocked.mockRejectedValueOnce(new TypeError("network"));
  open();
  const button = screen.getByRole("button", { name: "Crear credencial adicional" });
  act(() => { fireEvent.click(button); fireEvent.click(button); });
  await screen.findByText(/No pudimos confirmar/);
  mocked.mockResolvedValueOnce({ status: "created", credential: { ...issued, token: undefined } }).mockResolvedValueOnce({ integration });
  fireEvent.click(screen.getByRole("button", { name: "Consultar resultado" }));
  await screen.findByText(/La emisión está confirmada/);
  expect(screen.queryByText(issued.token)).not.toBeInTheDocument();
  expect(mocked.mock.calls.filter(call => call[1]?.method === "POST")).toHaveLength(1);
});

it("a not-yet-visible operation can only be resent using the same key and body", async () => {
  mocked.mockRejectedValueOnce(new TypeError("network")); open(); create();
  await screen.findByText(/No pudimos confirmar/);
  mocked.mockResolvedValueOnce({ status: "not_found" });
  fireEvent.click(screen.getByRole("button", { name: "Consultar resultado" }));
  const retry = await screen.findByRole("button", { name: "Reenviar la misma operación" });
  mocked.mockResolvedValueOnce(issued).mockResolvedValueOnce({ integration });
  fireEvent.click(retry); await screen.findByText(issued.token);
  const posts = mocked.mock.calls.filter(call => call[1]?.method === "POST");
  expect(posts).toHaveLength(2); expect(posts[0][1]).toEqual(posts[1][1]);
});

it("discards a late token after switching branch", async () => {
  let resolve!: (value: unknown) => void;
  mocked.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  const view = open(); create();
  view.rerender(<CredentialCreate key={3} branch={{ ...branch, id: 3 }} businessName="Other" onCreated={onCreated} />);
  await act(async () => resolve(issued));
  expect(screen.queryByText(issued.token)).not.toBeInTheDocument();
  expect(onCreated).not.toHaveBeenCalled(); expect(mocked).toHaveBeenCalledTimes(1);
});

it("keeps the token if routes fail and clears it explicitly when closing", async () => {
  mocked.mockResolvedValueOnce(issued).mockRejectedValueOnce(new Error("routes unavailable"));
  open(); create(); await screen.findByText(/No pudimos cargar las rutas/);
  expect(screen.getByText(issued.token)).toBeVisible();
  vi.spyOn(window, "confirm").mockReturnValue(true);
  fireEvent.click(screen.getByRole("button", { name: "Cerrar resultado" }));
  expect(screen.queryByText(issued.token)).not.toBeInTheDocument();
});
