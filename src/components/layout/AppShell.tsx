import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { ChevronRight, LogOut, Monitor } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import SidebarNav from "@/components/layout/SidebarNav";
import NotificationBell from "@/components/notifications/NotificationBell";
import { Skeleton } from "@/components/ui/Skeleton";
import { createClient } from "@/lib/supabase/server";

export interface Crumb {
  label: string;
  href?: string;
}

// Streams in after the shell, so no page has to wait on auth before rendering.
async function SignedInEmail() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = typeof data?.claims?.email === "string" ? data.claims.email : "";
  return (
    <p className="mb-2 truncate text-[12px] text-muted" title={email}>
      {email}
    </p>
  );
}

// Signed-in page chrome: narrow left sidebar + top bar with breadcrumbs.
export default function AppShell({
  crumbs,
  actions,
  children,
}: {
  crumbs: Crumb[];
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full overflow-hidden">
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-panel">
        <Link href="/" className="flex h-12 items-center gap-2 border-b border-border px-4">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent/15 text-accent">
            <Monitor size={14} />
          </span>
          <span className="text-[13px] font-medium">ESP Display Portal</span>
        </Link>

        <SidebarNav />

        <div className="border-t border-border p-3">
          <Suspense fallback={<Skeleton className="mb-3 mt-1 w-32" />}>
            <SignedInEmail />
          </Suspense>
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
          <div className="flex shrink-0 items-center gap-3">
            {actions}
            <NotificationBell />
          </div>
        </header>
        {/* The only scroll container on signed-in pages. `relative` makes it the containing block for
            absolutely positioned descendants without a closer positioned ancestor (e.g. `sr-only` spans);
            otherwise they resolve against the viewport and stretch the document, adding a second scrollbar. */}
        <main className="relative min-h-0 flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
