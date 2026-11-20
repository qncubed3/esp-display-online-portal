"use server";

// Devices belong to a user and subscribe to at most one Service (migration 007).
// Every query uses the signed-in user's client, so RLS decides what each call can see and change:
// owners manage their own devices; anyone with access to a Service can read the devices on it.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateDeviceKey, hashKey } from "./keys";

export interface DeviceRow {
  id: string;
  owner_id: string;
  service_id: string | null;
  name: string;
  last_seen_at: string | null;
  created_at: string;
  /** Seconds between polls; missing until migration 006 has run. */
  poll_seconds?: number;
}

/** A device on a Service's Devices tab; `mine` is true when the signed-in user owns it. */
export interface ServiceDeviceRow extends DeviceRow {
  mine: boolean;
}

/** One of the signed-in user's devices, with the name of the Service it's subscribed to. */
export interface MyDeviceRow extends DeviceRow {
  service_name: string | null;
}

/** A Service the user can subscribe a device to: their own or one shared with them. */
export interface SubscribableService {
  id: string;
  name: string;
  shared: boolean;
}

// "*" rather than a column list, so lists still load before migration 006 adds poll_seconds.
const COLUMNS = "*";

async function signedIn() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  return { supabase, user };
}

// The /devices page and every Service page the change touches.
function revalidateDevicePages(...serviceIds: (string | null | undefined)[]) {
  revalidatePath("/devices");
  for (const id of new Set(serviceIds)) if (id) revalidatePath(`/services/${id}`, "layout");
}

// RLS rejects a Service the device's owner can't access with 42501; say so plainly.
function writeError(error: { code?: string; message: string }): Error {
  if (error.code === "42501") return new Error("You can only subscribe a device to a Service you own or that is shared with you.");
  return new Error(error.message);
}

function cleanName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Device name is required");
  return trimmed.slice(0, 100);
}

// Own Services first, then shared ones, each by name. Feeds the Service dropdowns.
export async function listSubscribableServices(): Promise<SubscribableService[]> {
  const { supabase, user } = await signedIn();
  const { data, error } = await supabase.from("services").select("id, name, owner_id").order("name");
  if (error) throw new Error(error.message);
  return ((data ?? []) as { id: string; name: string; owner_id: string }[])
    .map((s) => ({ id: s.id, name: s.name, shared: s.owner_id !== user.id }))
    .sort((a, b) => Number(a.shared) - Number(b.shared) || a.name.localeCompare(b.name));
}

// The signed-in user's own devices, wherever they're subscribed.
export async function listMyDevices(): Promise<MyDeviceRow[]> {
  const { supabase, user } = await signedIn();
  const { data, error } = await supabase
    .from("devices")
    .select(`${COLUMNS}, service:services(name)`)
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as (DeviceRow & { service: { name: string } | null })[]).map(
    ({ service, ...d }) => ({ ...d, service_name: service?.name ?? null }),
  );
}

// Devices subscribed to one Service, the user's own and other people's.
export async function listServiceDevices(serviceId: string): Promise<ServiceDeviceRow[]> {
  const { supabase, user } = await signedIn();
  const { data, error } = await supabase
    .from("devices")
    .select(COLUMNS)
    .eq("service_id", serviceId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as DeviceRow[]).map((d) => ({ ...d, mine: d.owner_id === user.id }));
}

// Creates a device owned by the signed-in user (owner_id defaults to auth.uid()) and returns its key.
// The plain key is returned only here; just its hash is stored.
export async function addDevice(name: string, serviceId: string | null): Promise<{ id: string; key: string }> {
  const { supabase } = await signedIn();
  const key = generateDeviceKey();
  const { data, error } = await supabase
    .from("devices")
    .insert({ name: cleanName(name), service_id: serviceId || null, key_hash: hashKey(key) })
    .select("id")
    .single();
  if (error) throw writeError(error);
  revalidateDevicePages(serviceId);
  return { id: (data as { id: string }).id, key };
}

// Subscribes a device to another Service, or to none. Same key and firmware; the device gets the
// new Service's screen on its next poll. RLS only allows Services the owner can access.
export async function setDeviceService(deviceId: string, serviceId: string | null): Promise<void> {
  const { supabase } = await signedIn();
  const { data: before, error: readError } = await supabase
    .from("devices")
    .select("service_id")
    .eq("id", deviceId)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (!before) throw new Error("Device not found");
  const { data, error } = await supabase
    .from("devices")
    .update({ service_id: serviceId || null })
    .eq("id", deviceId)
    .select("id");
  if (error) throw writeError(error);
  if (!data || data.length === 0) throw new Error("Only the device's owner can change its Service");
  revalidateDevicePages((before as { service_id: string | null }).service_id, serviceId);
}

// Runs an owner-only update and revalidates the pages showing the device.
async function updateOwnDevice(deviceId: string, patch: Record<string, unknown>): Promise<void> {
  const { supabase } = await signedIn();
  const { data, error } = await supabase.from("devices").update(patch).eq("id", deviceId).select("service_id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("Device not found");
  revalidateDevicePages((data[0] as { service_id: string | null }).service_id);
}

export async function renameDevice(deviceId: string, name: string): Promise<void> {
  await updateOwnDevice(deviceId, { name: cleanName(name) });
}

// How often this device polls (15 s to 1 h); it picks the new value up on its next poll.
export async function setDevicePollSeconds(deviceId: string, seconds: number): Promise<void> {
  const s = Math.round(seconds);
  if (!(s >= 15 && s <= 3600)) throw new Error("Poll frequency must be between 15 seconds and 1 hour.");
  await updateOwnDevice(deviceId, { poll_seconds: s });
}

// Replaces a device's key; the old key stops working immediately. Returns the new key (shown once).
export async function regenerateDeviceKey(deviceId: string): Promise<string> {
  const key = generateDeviceKey();
  await updateOwnDevice(deviceId, { key_hash: hashKey(key) });
  return key;
}

export async function deleteDevice(deviceId: string): Promise<void> {
  const { supabase } = await signedIn();
  const { data, error } = await supabase.from("devices").delete().eq("id", deviceId).select("service_id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("Device not found");
  revalidateDevicePages((data[0] as { service_id: string | null }).service_id);
}
