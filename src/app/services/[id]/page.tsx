import { notFound } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import ServiceEditor from "@/components/services/ServiceEditor";
import ServiceHeader from "@/components/services/ServiceHeader";
import { requireUser } from "@/lib/auth";
import type { DrawRow } from "@/lib/draw/ops";

type Service = {
  id: string;
  name: string;
  owner_id: string;
  enabled: boolean;
  data_code: string;
  draw_ops: DrawRow[];
  updated_at: string;
};

export default async function ServicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("services")
    .select("id, name, owner_id, enabled, data_code, draw_ops, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const service = data as Service;
  const isOwner = service.owner_id === user.id;

  return (
    <AppShell email={user.email ?? ""} crumbs={[{ label: "Services", href: "/" }, { label: service.name }]}>
      <div className="mx-auto max-w-6xl px-6 py-6">
        <ServiceHeader serviceId={service.id} name={service.name} enabled={service.enabled} isOwner={isOwner} />
        <ServiceEditor
          serviceId={service.id}
          initialCode={service.data_code ?? ""}
          initialRows={Array.isArray(service.draw_ops) ? service.draw_ops : []}
        />
      </div>
    </AppShell>
  );
}
