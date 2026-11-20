import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";

// Supabase-settings-style card: title + description on top, body, optional footer bar.
export default function SettingsCard({
  title,
  description,
  footer,
  danger,
  children,
}: {
  title: string;
  description?: ReactNode;
  footer?: ReactNode;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={cn("rounded-md border bg-panel", danger ? "border-danger/40" : "border-border")}>
      <div className="border-b border-border px-4 py-4 md:px-5">
        <h2 className={cn("text-sm font-medium", danger && "text-[#ff8a8e]")}>{title}</h2>
        {description && <p className="mt-1 text-[13px] text-muted">{description}</p>}
      </div>
      <div className="px-4 py-4 md:px-5">{children}</div>
      {footer && (
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border px-4 py-3 md:px-5">{footer}</div>
      )}
    </section>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 py-2 sm:grid-cols-[180px_1fr] sm:items-center sm:gap-4">
      <span className="text-[13px] text-muted">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function Message({ error, success }: { error?: string; success?: string }) {
  if (error)
    return (
      <p role="alert" className="mr-auto text-[13px] text-[#ff8a8e]">
        {error}
      </p>
    );
  if (success)
    return (
      <p role="status" className="mr-auto text-[13px] text-accent">
        {success}
      </p>
    );
  return null;
}
