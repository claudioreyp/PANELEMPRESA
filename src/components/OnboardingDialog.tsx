import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function OnboardingDialog({ label, className, onClose, children }: {
  label: string; className: string; onClose: () => void; children: ReactNode;
}) {
  const panel = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); close.current(); }
      if (event.key !== "Tab") return;
      const targets = Array.from(panel.current?.querySelectorAll<HTMLElement>("button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex='0']") || [])
        .filter((element) => element.getClientRects().length && !element.matches(":disabled"));
      const first = targets[0], last = targets.at(-1);
      if (!first) { event.preventDefault(); panel.current?.focus(); }
      else if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      if (opener?.isConnected) opener.focus();
    };
  }, []);
  return createPortal(<div className="modal-backdrop"><section ref={panel} tabIndex={-1} className={`modal ${className}`} role="dialog" aria-modal="true" aria-label={label}>{children}</section></div>, document.body);
}
