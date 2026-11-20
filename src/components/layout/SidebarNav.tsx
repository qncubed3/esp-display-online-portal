"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, BookOpen, Cpu, KeyRound, LayoutGrid, LayoutTemplate, Settings, Users } from "lucide-react";

const SECTIONS = [
  [
    { href: "/", label: "My Services", icon: LayoutGrid },
    { href: "/shared", label: "Shared with me", icon: Users },
    { href: "/templates", label: "Templates", icon: LayoutTemplate },
  ],
  [
    { href: "/devices", label: "Devices", icon: Cpu },
    { href: "/overview", label: "Overview", icon: Activity },
  ],
  [
    { href: "/secrets", label: "Secrets", icon: KeyRound },
    { href: "/docs", label: "Docs", icon: BookOpen },
    { href: "/settings", label: "Settings", icon: Settings },
  ],
];

// "/" is active on the dashboard and on Service pages; others match their own path prefix.
function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/" || pathname.startsWith("/services/");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav className="flex-1 overflow-y-auto p-2">
      {SECTIONS.map((items, i) => (
        <div key={i} className={i > 0 ? "mt-2 border-t border-border pt-2" : ""}>
          {items.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex h-8 items-center gap-2 rounded-md px-2 text-[13px] transition-colors ${
                  active ? "bg-panel-hover text-fg" : "text-muted hover:bg-panel-hover hover:text-fg"
                }`}
              >
                <Icon size={14} className={active ? "text-fg" : "text-muted"} />
                {label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
