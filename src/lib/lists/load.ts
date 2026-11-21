// Loaders for the cached lists, served by GET /api/lists/<name>. They run with the signed-in
// user's client, so RLS decides what each one can see. The one exception: owners' emails on shared
// Services come from the admin API (users can't read auth.users), for Services the user can see.

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadDeviceList } from "@/lib/device-list/load";
import { listSubscribableServices } from "@/lib/devices/actions";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DrawRow } from "@/lib/draw/ops";
import type { ListName, Lists, ServiceCard, SharedService } from "./types";

type DeviceCount = { count: number }[];

// The user's own Services, most recently updated first. Shared ones are on /shared.
async function loadServices(supabase: SupabaseClient, userId: string): Promise<ServiceCard[]> {
  const { data, error } = await supabase
    .from("services")
    .select("id, name, enabled, updated_at, draw_ops, devices(count)")
    .eq("owner_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  type Row = Omit<ServiceCard, "draw_ops" | "deviceCount"> & { draw_ops: DrawRow[] | null; devices: DeviceCount };
  return ((data ?? []) as Row[]).map(({ devices, draw_ops, ...s }) => ({
    ...s,
    draw_ops: Array.isArray(draw_ops) ? draw_ops : [],
    deviceCount: devices?.[0]?.count ?? 0,
  }));
}

// Services other people shared with the user, newest share first.
async function loadShared(supabase: SupabaseClient, userId: string): Promise<SharedService[]> {
  type Svc = { id: string; name: string; enabled: boolean; owner_id: string; draw_ops: DrawRow[] | null; devices: DeviceCount };
  type Row = { created_at: string; seen_at: string | null; services: Svc | Svc[] | null };
  const { data, error } = await supabase
    .from("service_members")
    .select("created_at, seen_at, services(id, name, enabled, owner_id, draw_ops, devices(count))")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as Row[];
  const svcOf = (r: Row) => (Array.isArray(r.services) ? r.services[0] : r.services);
  const emails = await ownerEmails(rows.flatMap((r) => svcOf(r)?.owner_id ?? []));
  return rows.flatMap((r) => {
    const svc = svcOf(r);
    if (!svc) return [];
    return [
      {
        id: svc.id,
        name: svc.name,
        enabled: svc.enabled,
        deviceCount: svc.devices?.[0]?.count ?? 0,
        draw_ops: Array.isArray(svc.draw_ops) ? svc.draw_ops : [],
        ownerEmail: emails.get(svc.owner_id) ?? null,
        addedAt: r.created_at,
        isNew: r.seen_at === null,
      },
    ];
  });
}

// Emails for the owners of Services shared with the user. A failed lookup just leaves the line out.
async function ownerEmails(ownerIds: string[]): Promise<Map<string, string>> {
  const admin = createAdminClient();
  const entries = await Promise.all(
    [...new Set(ownerIds)].map(async (id) => {
      const { data } = await admin.auth.admin.getUserById(id).catch(() => ({ data: { user: null } }));
      return [id, data.user?.email ?? ""] as const;
    }),
  );
  return new Map(entries.filter(([, email]) => email));
}

export async function loadList<K extends ListName>(supabase: SupabaseClient, userId: string, name: K): Promise<Lists[K]> {
  const loaders: { [N in ListName]: () => Promise<Lists[N]> } = {
    services: () => loadServices(supabase, userId),
    shared: () => loadShared(supabase, userId),
    devices: () => loadDeviceList(supabase, userId),
    subscribable: () => listSubscribableServices(),
  };
  return loaders[name]();
}
