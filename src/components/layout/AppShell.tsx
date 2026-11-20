import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight, LayoutGrid, LogOut, Monitor } from "lucide-react";
import { signOut } from "@/app/auth/actions";

export interface Crumb {
  label: string;
  href?: string;
}

// Signed-in page chrome: narrow left sidebar + top bar with breadcrumbs.
export default function AppShell({
  email,
  crumbs,
  actions,
  children,
}: {
  email: string;
  crumbs: Crumb[];
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full">
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-panel">
        <Link href="/" className="flex h-12 items-center gap-2 border-b border-border px-4">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent/15 text-accent">
            <Monitor size={14} />
          </span>
          <span className="text-[13px] font-medium">ESP Display Portal</span>
        </Link>

        <nav className="flex-1 p-2">
          <Link
            href="/"
            className="flex h-8 items-center gap-2 rounded-md bg-panel-hover px-2 text-[13px] text-fg"
          >
            <LayoutGrid size={14} className="text-muted" />
            Services
          </Link>
        </nav>

        <div className="border-t border-border p-3">
          <p className="mb-2 truncate text-[12px] text-muted" title={email}>
            {email}
          </p>
          <form action={signOut}>
            <button
              type="submit"
              className="flex h-7 w-full cursor-pointer items-center gap-2 rounded-md px-2 text-[13px] text-muted transition-colors hover:bg-panel-hover hover:text-fg"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-border px-6">
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-[13px]">
            {crumbs.map((c, i) => (
              <span key={i} className="flex min-w-0 items-center gap-1.5">
                {i > 0 && <ChevronRight size={14} className="shrink-0 text-muted/60" />}
                {c.href ? (
                  <Link href={c.href} className="truncate text-muted hover:text-fg">
                    {c.label}
                  </Link>
                ) : (
                  <span className="truncate text-fg">{c.label}</span>
                )}
              </span>
            ))}
          </nav>
          {actions}
        </header>
        <main className="min-h-0 flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
