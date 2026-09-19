import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PasswordResetDialog } from "./PasswordResetDialog";
import { api, ApiError } from "../lib/api";
import type { Membership } from "../types";

vi.mock("../lib/api", async () => ({ ...(await vi.importActual("../lib/api")), api: vi.fn() }));
const member: Membership = { id: 4, business_id: 2, branch_id: null, email: "owner@example.test",
  full_name: "Propietario de prueba", role: "owner", active: true, created_at: "", updated_at: "",
  password_security_version: 0, can_reset_password: true };
const updated = vi.fn();
beforeEach(() => { vi.clearAllMocks(); vi.spyOn(window, "confirm").mockReturnValue(true); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function open() { return render(<PasswordResetDialog member={member} onClose={vi.fn()} onUpdated={updated} />); }
function fill() {
  fireEvent.change(screen.getByLabelText(/Nueva contraseña/), { target: { value: "Safe-owner-pass-2030!" } });
  fireEvent.change(screen.getByLabelText("Confirmar contraseña"), { target: { value: "Safe-owner-pass-2030!" } });
}
it("requires matching passwords before sending", () => {
  open(); fill(); fireEvent.change(screen.getByLabelText("Confirmar contraseña"), { target: { value: "different" } });
  fireEvent.click(screen.getByRole("button", { name: "Renovar contraseña y cerrar sesiones" }));
  expect(api).not.toHaveBeenCalled(); expect(screen.getByText("Las contraseñas no coinciden.")).toBeVisible();
});
it("does not submit twice and only offers copying after success", async () => {
  let finish!: (value: unknown) => void;
  vi.mocked(api).mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  open(); fill(); const button = screen.getByRole("button", { name: "Renovar contraseña y cerrar sesiones" });
  fireEvent.click(button); fireEvent.click(button);
  expect(api).toHaveBeenCalledTimes(1); expect(screen.queryByText("Contraseña renovada")).toBeNull();
  finish({ status: "succeeded", operation_id: "operation", security_version: 1, client_pos_url: "https://pos.example.test" });
  expect(await screen.findByRole("button", { name: "Copiar acceso a CLIENTES" })).toBeVisible();
  expect(localStorage.getItem("password")).toBeNull();
});
it("reconciles a lost response without another POST", async () => {
  vi.mocked(api).mockRejectedValueOnce(new TypeError("network"));
  open(); fill(); fireEvent.click(screen.getByRole("button", { name: "Renovar contraseña y cerrar sesiones" }));
  const check = await screen.findByRole("button", { name: "Consultar resultado" });
  vi.mocked(api).mockResolvedValueOnce({ status: "succeeded", operation_id: "op", security_version: 1, client_pos_url: "https://pos.example.test" });
  fireEvent.click(check);
  await screen.findByText("Contraseña renovada");
  expect(vi.mocked(api).mock.calls[1][0]).toMatch(/\/lookup$/);
  expect(vi.mocked(api).mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
});
it("preserves the draft after a confirmed validation failure", async () => {
  vi.mocked(api).mockRejectedValueOnce(new ApiError("Revisa la contraseña", 422));
  open(); fill(); fireEvent.click(screen.getByRole("button", { name: "Renovar contraseña y cerrar sesiones" }));
  await screen.findByText("Revisa la contraseña");
  expect(screen.getByLabelText(/Nueva contraseña/)).toHaveValue("Safe-owner-pass-2030!");
});
it("discards secrets when unmounted and does not act on a late result", async () => {
  let finish!: (value: unknown) => void;
  vi.mocked(api).mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  const view = open(); fill(); fireEvent.click(screen.getByRole("button", { name: "Renovar contraseña y cerrar sesiones" }));
  view.unmount(); finish({ status: "succeeded" });
  await waitFor(() => expect(updated).not.toHaveBeenCalled());
  open(); expect(screen.getByLabelText(/Nueva contraseña/)).toHaveValue("");
});
