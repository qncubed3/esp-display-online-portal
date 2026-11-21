"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X } from "lucide-react";

const DRAWER_ID = "mobile-nav-drawer";
// Slide-out time. Links in the drawer wait this long before navigating: every page renders its
// own AppShell, so navigating at once would unmount the drawer mid-slide.
const CLOSE_MS = 200;

// Below `md`: hamburger button + slide-in drawer holding the server-rendered sidebar (passed as children).
// The drawer overlays the page, so the content never shifts.
export default function MobileNav({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  // Remember which path the drawer was opened on: navigating anywhere else closes it without an effect.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn === pathname;
  const close = () => setOpenedOn(null);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (!open) {
      // Hand focus back to the hamburger when the drawer closes (but not on first render).
      if (wasOpen.current) buttonRef.current?.focus({ preventScroll: true });
      wasOpen.current = false;
      return;
    }
    wasOpen.current = true;
    const panel = panelRef.current;
    // preventScroll: focusing the panel mid-slide would otherwise scroll it into view and jump.
    panel?.focus({ preventScroll: true });

    // Lock scrolling behind the drawer: the page and the app's own scroll container.
    const main = document.getElementById("app-main");
    const prevBody = document.body.style.overflow;
    const prevMain = main?.style.overflow ?? "";
    document.body.style.overflow = "hidden";
    if (main) main.style.overflow = "hidden";

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpenedOn(null);
        return;
      }
      // Keep Tab inside the drawer while it is modal.
      if (e.key === "Tab" && panel) {
        const items = panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || active === panel)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevBody;
      if (main) main.style.overflow = prevMain;
    };
  }, [open]);

  return (
    <div className="shrink-0 md:hidden">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpenedOn(pathname)}
        aria-label="Open navigation"
        aria-expanded={open}
        aria-controls={DRAWER_ID}
        className="-ml-1.5 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted transition-colors hover:bg-panel-hover hover:text-fg"
      >
        <Menu size={18} />
      </button>

      <div
        aria-hidden="true"
        onClick={close}
        // Fades with the drawer's timing; no fade with reduced motion.
        className={`fixed inset-0 z-40 bg-black/60 transition-[opacity,visibility] motion-reduce:transition-none ${
          open ? "opacity-100 duration-300 ease-out" : "pointer-events-none invisible opacity-0 duration-200 ease-in"
        }`}
      />

      <div
        id={DRAWER_ID}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        tabIndex={-1}
        inert={!open}
        // Following any link closes the drawer (including one to the page that is already open),
        // then navigates once it has slid out. Modified clicks (new tab etc.) keep their default.
        onClick={(e) => {
          const link = (e.target as HTMLElement).closest("a");
          if (!link) return;
          close();
          const href = link.getAttribute("href");
          if (!href || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || link.target === "_blank" || href.startsWith("http")) return;
          e.preventDefault();
          if (href !== pathname) setTimeout(() => router.push(href), CLOSE_MS);
        }}
        // Always mounted so it can slide out: `visibility` flips only after the exit transform finishes.
        // Opens over 300ms on a decelerating curve (fast start, soft landing); closes in 200ms.
        className={`fixed inset-y-0 left-0 z-50 flex w-64 max-w-[85vw] flex-col border-r border-border bg-panel shadow-2xl outline-none transition-[transform,visibility] will-change-transform motion-reduce:transition-none ${
          open
            ? "translate-x-0 duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
            : "invisible -translate-x-full duration-200 ease-[cubic-bezier(0.4,0,1,1)]"
        }`}
      >
        {children}
        <button
          type="button"
          onClick={close}
          aria-label="Close navigation"
          className="absolute right-2 top-2 flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted transition-colors hover:bg-panel-hover hover:text-fg"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
