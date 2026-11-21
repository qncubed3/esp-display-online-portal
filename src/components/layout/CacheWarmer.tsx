"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { warmLists } from "@/lib/store/cache";

// Tabs warmed on the first signed-in page: their pages render from the client cache, so a full
// prefetch is just the shell and is kept by the router for a few minutes.
const ROUTES = ["/", "/shared", "/devices"];

// Mounted by AppShell. Once per page load, when the browser is idle, loads the Services, shared
// Services and devices into the client cache and prefetches their routes, so the tabs open at once.
export default function CacheWarmer() {
  const router = useRouter();

  useEffect(() => {
    const run = () => {
      if (!warmLists()) return;
      for (const href of ROUTES) router.prefetch(href);
    };
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(run, { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(run, 500);
    return () => clearTimeout(id);
  }, [router]);

  return null;
}
