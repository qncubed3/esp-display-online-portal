// Client-side cache for the lists the sidebar tabs show (My Services, Shared with me, Devices) and
// the screen previews on the My Services cards, so switching tabs shows the last data straight away
// and refreshes it in the background (stale-while-revalidate).
//
// In memory only: the data is gone on reload or sign out, and never written to localStorage (shared
// computers). Only the number of items per list is remembered there, so the loading skeleton can
// show as many cards as the list had last time.
//
// Client components only. The store also exists on the server during SSR, but nothing writes to it
// there: every load starts from an effect or an event handler.

import { unstable_rethrow } from "next/navigation";
import { useEffect } from "react";
import { create } from "zustand";
import { LIST_NAMES, type ListName, type Lists, type ServiceCard } from "@/lib/lists/types";
import type { DeviceListRow } from "@/lib/device-list/types";

const STALE_MS = 30_000; // refetch a list on mount or window focus once it's older than this
const PREVIEW_TTL_MS = 60_000;
const COUNTS_KEY = "esp-portal:list-counts";

type Vars = Record<string, string | number | boolean>;

export interface Entry<T> {
  data?: T;
  error?: string; // the last load failed; `data` (if any) is from before
  fetchedAt: number; // ms; 0 = never loaded
  stale?: boolean; // the user changed it in a way we couldn't patch in; hidden until refetched
}

type ListEntries = { [K in ListName]: Entry<Lists[K]> };

interface CacheState {
  lists: ListEntries;
  counts: Partial<Record<ListName, number>>; // items last seen per list (also in localStorage)
  previews: Record<string, { vars: Vars; fetchedAt: number }>; // by Service id
}

function emptyLists(): ListEntries {
  return { services: { fetchedAt: 0 }, shared: { fetchedAt: 0 }, devices: { fetchedAt: 0 }, subscribable: { fetchedAt: 0 } };
}

export const useCache = create<CacheState>()(() => ({ lists: emptyLists(), counts: {}, previews: {} }));

// ---------- remembered counts

function readCounts(): CacheState["counts"] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(COUNTS_KEY) ?? "{}");
    const counts: CacheState["counts"] = {};
    if (parsed && typeof parsed === "object") {
      for (const name of LIST_NAMES) {
        const n = (parsed as Record<string, unknown>)[name];
        if (typeof n === "number" && n >= 0) counts[name] = Math.floor(n);
      }
    }
    return counts;
  } catch {
    return {};
  }
}

function writeCounts(counts: CacheState["counts"]) {
  try {
    localStorage.setItem(COUNTS_KEY, JSON.stringify(counts));
  } catch {
    // Storage blocked or full: skeletons just fall back to the default count.
  }
}

// Set after creation, so getInitialState() (what React uses while hydrating) stays empty and the
// first client render matches the server's default skeleton.
if (typeof window !== "undefined") useCache.setState({ counts: readCounts() });

function rememberCount(name: ListName, n: number) {
  if (name === "subscribable" || useCache.getState().counts[name] === n) return;
  const counts = { ...useCache.getState().counts, [name]: n };
  useCache.setState({ counts });
  writeCounts(counts);
}

// ---------- lists

const inflight = new Map<ListName, Promise<void>>();
// Bumped by every forced load and by clearCache(), so an older request that lands late is ignored.
const generation: Record<ListName, number> = { services: 0, shared: 0, devices: 0, subscribable: 0 };

function setEntry<K extends ListName>(name: K, patch: Partial<Entry<Lists[K]>>) {
  useCache.setState((s) => ({ lists: { ...s.lists, [name]: { ...s.lists[name], ...patch } } }));
}

async function fetchList<K extends ListName>(name: K): Promise<Lists[K]> {
  const res = await fetch(`/api/lists/${name}`, { cache: "no-store" });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok || !Array.isArray(body)) throw new Error((body as { error?: string } | null)?.error ?? `HTTP ${res.status}`);
  return body as Lists[K];
}

// Loads a list unless the cached copy is younger than `maxAge`. Callers at the same time share one
// request. `force` always starts a new request, which replaces any older one still in flight.
export function loadList(name: ListName, { force = false, maxAge = STALE_MS } = {}): Promise<void> {
  const entry = useCache.getState().lists[name];
  if (!force) {
    const pending = inflight.get(name);
    if (pending) return pending;
    if (entry.data !== undefined && !entry.stale && Date.now() - entry.fetchedAt < maxAge) return Promise.resolve();
  }
  const gen = ++generation[name];
  const request = fetchList(name)
    .then(
      (data) => {
        if (gen !== generation[name]) return;
        setEntry(name, { data, error: undefined, fetchedAt: Date.now(), stale: false });
        rememberCount(name, data.length);
      },
      (e: unknown) => {
        if (gen !== generation[name]) return;
        setEntry(name, { error: e instanceof Error ? e.message : String(e) });
      },
    )
    .finally(() => {
      if (inflight.get(name) === request) inflight.delete(name);
    });
  inflight.set(name, request);
  return request;
}

// A list for a page: the cached copy straight away (hidden while `stale`), refreshed on mount and
// on window focus when older than 30 s.
export function useList<K extends ListName>(name: K): { data?: Lists[K]; error?: string; fetchedAt: number } {
  const entry = useCache((s) => s.lists[name]) as Entry<Lists[K]>;
  useEffect(() => {
    void loadList(name);
    const onFocus = () => void loadList(name);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [name]);
  return { data: entry.stale ? undefined : entry.data, error: entry.error, fetchedAt: entry.fetchedAt };
}

// How many items the list had last time (undefined: never seen on this browser).
export function useListCount(name: ListName): number | undefined {
  return useCache((s) => s.counts[name]);
}

// After the user's own change: refetch now, keeping the current copy on screen until it arrives.
// Lists that were never loaded are left alone (they load when a page needs them).
export function refreshLists(...names: ListName[]) {
  for (const name of names) {
    if (useCache.getState().lists[name].data !== undefined || inflight.has(name)) void loadList(name, { force: true });
  }
}

// After a change that can't be patched in (a new Service, a delete that redirected): hide the
// cached copy, so the next page shows the skeleton rather than old data, and refetch now.
// Call it once the action has finished, or the refetch could see the data from before.
export function invalidateLists(...names: ListName[]) {
  for (const name of names) {
    if (useCache.getState().lists[name].data !== undefined) setEntry(name, { stale: true });
    refreshLists(name);
  }
}

// True for the rejection a Server Action's redirect() produces on the client. The action finished
// (the change is saved) and the router is already navigating.
export function isRedirect(e: unknown): boolean {
  try {
    unstable_rethrow(e);
    return false;
  } catch {
    return true;
  }
}

function patchList<K extends ListName>(name: K, fn: (data: Lists[K]) => Lists[K]) {
  const data = useCache.getState().lists[name].data as Lists[K] | undefined;
  if (data !== undefined) setEntry(name, { data: fn(data) });
}

// A Service changed (rename, on/off, saved code or screen). Patches every cached list that shows
// it, then refetches My Services for the rest (order, timestamps).
export function patchService(id: string, fields: Partial<Pick<ServiceCard, "name" | "enabled" | "draw_ops">>) {
  const at = new Date().toISOString();
  patchList("services", (list) => list.map((s) => (s.id === id ? { ...s, ...fields, updated_at: at } : s)));
  const { draw_ops: _, ...summary } = fields;
  patchList("shared", (list) => list.map((s) => (s.id === id ? { ...s, ...summary } : s)));
  if (fields.name !== undefined) {
    const name = fields.name;
    patchList("subscribable", (list) => list.map((s) => (s.id === id ? { ...s, name } : s)));
    patchList("devices", (list) => list.map((d) => (d.serviceId === id ? { ...d, serviceName: name } : d)));
  }
  if (fields.draw_ops !== undefined) dropPreview(id);
  refreshLists("services");
}

// One of the user's devices changed on /devices. Patches the row, then refetches the devices, and
// both Service lists too when their device counts change. `null` removes the row (deleted, transferred).
export function patchDevice(id: string, fields: Partial<DeviceListRow> | null) {
  patchList("devices", (list) =>
    fields ? list.map((d) => (d.id === id ? { ...d, ...fields } : d)) : list.filter((d) => d.id !== id),
  );
  if (!fields || "serviceId" in fields) devicesChanged();
  else refreshLists("devices");
}

// Devices were added, moved or removed: refetch the device list and the Services' device counts.
export function devicesChanged() {
  refreshLists("devices", "services", "shared");
}

// Shared with me was visited, so nothing there is new any more.
export function markSharedSeen() {
  patchList("shared", (list) => (list.some((s) => s.isNew) ? list.map((s) => ({ ...s, isNew: false })) : list));
}

// ---------- screen previews (the Data code's variables for a My Services card)

const previewInflight = new Map<string, Promise<void>>();

// Runs the Service's saved Data code via /api/preview unless a result younger than 60 s is cached.
// A failure caches empty variables, so the screen is still drawn.
export function loadPreview(serviceId: string): void {
  const cached = useCache.getState().previews[serviceId];
  if (previewInflight.has(serviceId) || (cached && Date.now() - cached.fetchedAt < PREVIEW_TTL_MS)) return;
  const request: Promise<void> = fetch("/api/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ serviceId }),
  })
    .then((r) => r.json())
    .then((b: { vars?: Vars }) => b.vars ?? {})
    .catch((): Vars => ({}))
    .then((vars) => {
      if (previewInflight.get(serviceId) !== request) return; // dropped meanwhile
      previewInflight.delete(serviceId);
      useCache.setState((s) => ({ previews: { ...s.previews, [serviceId]: { vars, fetchedAt: Date.now() } } }));
    });
  previewInflight.set(serviceId, request);
}

export function dropPreview(serviceId: string) {
  previewInflight.delete(serviceId);
  useCache.setState((s) => {
    const { [serviceId]: _, ...rest } = s.previews;
    return { previews: rest };
  });
}

// ---------- warm-up and sign out

let warmed = false;

// Loads every list in the background, once per page load (see CacheWarmer). False if already done.
export function warmLists(): boolean {
  if (warmed) return false;
  warmed = true;
  for (const name of LIST_NAMES) void loadList(name);
  return true;
}

// Signing out: forget everything, including the remembered counts.
export function clearCache() {
  for (const name of LIST_NAMES) generation[name]++;
  inflight.clear();
  previewInflight.clear();
  warmed = false;
  useCache.setState({ lists: emptyLists(), counts: {}, previews: {} });
  try {
    localStorage.removeItem(COUNTS_KEY);
  } catch {
    // Nothing to clear if storage is blocked.
  }
}
