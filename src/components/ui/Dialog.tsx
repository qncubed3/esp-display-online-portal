"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "./cn";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  bodyClassName?: string;
}

// Native <dialog> modal: Esc and backdrop click close it.
export function Dialog({ open, onClose, title, children, footer, className, bodyClassName }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={cn(
        // Width leaves a 1rem gutter each side so the dialog never touches the viewport edge on phones.
        "m-auto w-[calc(100%-2rem)] rounded-md border border-border bg-panel p-0 text-fg shadow-2xl backdrop:bg-black/60",
        // cn doesn't resolve conflicting classes, so only add the defaults when the caller gives none.
        !className?.includes("max-w-") && "max-w-md",
        !className?.includes("max-h-") && "max-h-[calc(100dvh-2rem)] overflow-y-auto",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-medium">{title}</h2>
        <button type="button" onClick={onClose} className="cursor-pointer text-muted hover:text-fg" aria-label="Close">
          <X size={16} />
        </button>
      </div>
      <div className={cn("px-4 py-4", bodyClassName)}>{children}</div>
      {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-border px-4 py-3">{footer}</div>}
    </dialog>
  );
}

export default Dialog;
