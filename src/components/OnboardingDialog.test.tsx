import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { OnboardingDialog } from "./OnboardingDialog";

afterEach(cleanup);

it("opens outside the animated page, locks scrolling and restores focus", () => {
  const opener = document.createElement("button");
  document.body.append(opener); opener.focus();
  const close = vi.fn();
  const view = render(<div className="page-stack"><OnboardingDialog label="Access" className="onboarding-modal" onClose={close}><button>First</button><button>Last</button></OnboardingDialog></div>);
  const dialog = screen.getByRole("dialog", { name: "Access" });
  expect(dialog).toHaveFocus();
  expect(dialog.closest(".page-stack")).toBeNull();
  expect(document.body.style.overflow).toBe("hidden");
  fireEvent.keyDown(dialog, { key: "Escape" });
  expect(close).toHaveBeenCalledTimes(1);
  view.unmount();
  expect(document.body.style.overflow).toBe("");
  expect(opener).toHaveFocus();
  opener.remove();
});

it("contains keyboard focus without closing or submitting on Tab", () => {
  const geometry = vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
  const close = vi.fn();
  render(<OnboardingDialog label="Access" className="onboarding-modal" onClose={close}><button>First</button><button disabled>Busy</button><button>Last</button></OnboardingDialog>);
  const first = screen.getByRole("button", { name: "First" }), last = screen.getByRole("button", { name: "Last" });
  first.focus(); fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
  expect(last).toHaveFocus();
  fireEvent.keyDown(last, { key: "Tab" });
  expect(first).toHaveFocus();
  expect(close).not.toHaveBeenCalled();
  geometry.mockRestore();
});
