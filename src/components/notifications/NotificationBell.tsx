"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import ServiceLink from "@/components/services/ServiceLink";
import { Bell, Loader2 } from "lucide-react";
import { listNotifications, markNotificationsSeen, type NotificationRow } from "@/lib/sharing/actions";
import { cn } from "@/components/ui/cn";
import { timeAgo } from "@/lib/time";

// Top-bar bell: Services the user was added to, devices transferred to them. Opening the dropdown marks them all seen.
export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationRow[] | null>(null);
  const [error, setError] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      setItems(await listNotifications());
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Closing clears unread state locally (the server copy was marked seen on open).
  const close = useCallback(() => {
    setOpen(false);
    setItems((prev) => prev?.map((n) => (n.seen_at ? n : { ...n, seen_at: new Date().toISOString() })) ?? prev);
  }, []);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const unread = items?.filter((n) => !n.seen_at).length ?? 0;

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (!next) return;
    // Refresh, then mark everything seen. Keep the unread styling visible while the dropdown is open.
    await load();
    try {
      await markNotificationsSeen();
    } catch {
      // Non-fatal: the dot just comes back on next load.
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => (open ? close() : toggle())}
        aria-label={unread ? `Notifications (${unread} unread)` : "Notifications"}
        aria-expanded={open}
        className={cn(
          "relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted transition-colors hover:bg-panel-hover hover:text-fg",
          open && "bg-panel-hover text-fg",
        )}
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-semibold leading-none text-[#111]">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full right-0 z-50 mt-2 w-80 overflow-hidden rounded-md border border-border bg-panel shadow-2xl">
          <div className="border-b border-border px-3 py-2 text-[13px] font-medium">Notifications</div>
          {items === null ? (
            <p className="flex items-center gap-2 px-3 py-6 text-[13px] text-muted">
              <Loader2 size={14} className="animate-spin" /> Loading…
            </p>
          ) : error && items.length === 0 ? (
            <p className="px-3 py-6 text-center text-[13px] text-[#ff8a8e]">Could not load notifications.</p>
          ) : items.length === 0 ? (
            <p className="px-3 py-6 text-center text-[13px] text-muted">No notifications</p>
          ) : (
            <ul className="max-h-96 divide-y divide-border overflow-auto">
              {items.map((n) => {
                const body = (
                  <>
                    <span
                      className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", n.seen_at ? "bg-transparent" : "bg-accent")}
                      aria-hidden
                    />
                    <span className="min-w-0">
                      <span className="block text-[13px] text-fg">
                        {n.kind === "shared" ? (
                          <>
                            You were added to <span className="font-medium">{n.service_name}</span>
                          </>
                        ) : (
                          <>
                            {n.from_email} transferred <span className="font-medium">{n.device_name}</span> to you
                          </>
                        )}
                      </span>
                      <span className="block text-[12px] text-muted" title={new Date(n.created_at).toLocaleString()}>
                        {timeAgo(n.created_at)}
                      </span>
                    </span>
                  </>
                );
                const cls = "flex items-start gap-2.5 px-3 py-2.5 transition-colors hover:bg-panel-hover";
                return (
                  <li key={n.id}>
                    {n.kind === "shared" ? (
                      <ServiceLink service={{ id: n.service_id, name: n.service_name, shared: true }} onClick={close} className={cls}>
                        {body}
                      </ServiceLink>
                    ) : (
                      <Link href="/devices" onClick={close} className={cls}>
                        {body}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
