import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AgentContextSummary } from "./AgentContextSummary";

const { api } = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("../lib/api", () => ({ api }));
const context = {
  branch_id: 1, agent: { name: "Ana" },
  location: { address: "Direccion POS", phone: null, maps_url: null, latitude: -4.5, longitude: -80.5 },
  payments: { yape: { number: "999888777", recipient_name: "Titular POS", qr_configured: true }, plin_number: null },
  delivery: { enabled: true, mode: "quote", fee: null, fee_status: "pending_quote", minimum_order_amount: 10, free_delivery_threshold: null, bands: [], policy: null },
};
beforeEach(() => api.mockReset().mockResolvedValue(context));
afterEach(cleanup);

it("renders POS data read-only and does not describe pending quotes as free", async () => {
  const view = render(<AgentContextSummary branchId={1} />);
  expect(await screen.findByText("Titular POS")).toBeVisible();
  expect(screen.getByText("Por cotizar")).toBeVisible();
  expect(screen.queryByText("0 S/")).not.toBeInTheDocument();
  expect(view.container.querySelectorAll("input,textarea,select")).toHaveLength(0);
  expect(screen.queryByRole("button", { name: /Guardar|Subir/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Actualizar consulta" }));
  expect(api).toHaveBeenLastCalledWith("/admin/branches/1/agent-context");
});

it("labels a failed refresh and offers a retry without claiming freshness", async () => {
  render(<AgentContextSummary branchId={1} />); await screen.findByText("Titular POS");
  api.mockRejectedValueOnce(new Error("Sin conexion"));
  fireEvent.click(screen.getByRole("button", { name: "Actualizar consulta" }));
  expect(await screen.findByText(/No se pudo actualizar el contexto/)).toBeVisible();
});

it("discards late results from another branch", async () => {
  let resolve!: (value: unknown) => void;
  api.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
  const view = render(<AgentContextSummary branchId={1} />);
  api.mockResolvedValue({ ...context, branch_id: 2, agent: { name: "Sucursal dos" } });
  view.rerender(<AgentContextSummary branchId={2} />);
  await screen.findByText("Sucursal dos");
  await act(async () => resolve(context));
  expect(screen.queryByText("Ana")).not.toBeInTheDocument();
});
