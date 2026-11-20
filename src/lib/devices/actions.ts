"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateDeviceKey, hashKey } from "./keys";

export interface DeviceRow {
  id: string;
  service_id: string;
  name: string;
  last_seen_at: string | null;
  created_at: string;
}

const COLUMNS = "id, service_id, name, last_seen_at, created_at";

function revalidateService(serviceId: string) {
  revalidatePath(`/services/${serviceId}`, "layout");
}

// Devices of one Service. RLS limits this to the signed-in owner's rows.
export async function listDevices(serviceId: string): Promise<DeviceRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("devices")
    .select(COLUMNS)
    .eq("service_id", serviceId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as DeviceRow[];
}

// Creates a device and returns its key. The plain key is returned only here; just its hash is stored.
export async function addDevice(serviceId: string, name: string): Promise<{ id: string; key: string }> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Device name is required");
  const supabase = await createClient();
  const key = generateDeviceKey();
  const { data, error } = await supabase
    .from("devices")
    .insert({ service_id: serviceId, name: trimmed.slice(0, 100), key_hash: hashKey(key) })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidateService(serviceId);
  return { id: (data as { id: string }).id, key };
}

export async function deleteDevice(deviceId: string): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("devices").delete().eq("id", deviceId).select("service_id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("Device not found");
  revalidateService((data[0] as { service_id: string }).service_id);
}

// Replaces a device's key; the old key stops working immediately. Returns the new key (shown once).
export async function regenerateDeviceKey(deviceId: string): Promise<string> {
  const supabase = await createClient();
  const key = generateDeviceKey();
  const { data, error } = await supabase
    .from("devices")
    .update({ key_hash: hashKey(key) })
    .eq("id", deviceId)
    .select("service_id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("Device not found");
  revalidateService((data[0] as { service_id: string }).service_id);
  return key;
}
