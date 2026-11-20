"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getTemplate } from "./catalog";

// Creates a Service from a template (looked up by id on the server, so the client can't
// inject code or ops) and opens it. Row ids are fresh so each copy is independent.
export async function createServiceFromTemplate(templateId: string, name: string): Promise<{ error: string }> {
  const template = getTemplate(templateId);
  if (!template) return { error: "Unknown template." };
  const trimmed = name.trim();
  if (!trimmed) return { error: "Name is required." };

  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("services")
    .insert({
      name: trimmed.slice(0, 100),
      data_code: template.dataCode,
      draw_ops: template.rows.map((r) => ({ ...r, id: crypto.randomUUID() })),
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Could not create service." };

  redirect(`/services/${data.id}`);
}
