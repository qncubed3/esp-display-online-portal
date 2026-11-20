import { Suspense } from "react";
import { KeyRound } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import SecretsManager from "@/components/secrets/SecretsManager";
import { TableRowsSkeleton } from "@/components/ui/Skeleton";
import { requireUser } from "@/lib/auth";
import type { SecretRow } from "@/lib/secrets/actions";

export default function SecretsPage() {
  return (
    <AppShell crumbs={[{ label: "Secrets" }]}>
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-2 flex items-center gap-2">
          <KeyRound size={18} className="text-muted" />
          <h1 className="text-xl font-medium">Secrets</h1>
        </div>
        <p className="mb-6 max-w-2xl text-[13px] text-muted">
          Use these in a Service&apos;s Data code as <code className="font-mono text-fg">secrets.NAME</code>. A Service
          uses its owner&apos;s secrets, so people you share a Service with can use them but can&apos;t see them.
        </p>
        <Suspense
          fallback={
            <div className="rounded-md border border-border bg-panel">
              <TableRowsSkeleton rows={3} cols={3} />
            </div>
          }
        >
          <SecretsList />
        </Suspense>
      </div>
    </AppShell>
  );
}

async function SecretsList() {
  const { supabase } = await requireUser();
  // Names and times only: values are fetched on demand (reveal/copy) and never rendered into the page.
  const { data, error } = await supabase
    .from("user_secrets")
    .select("name, created_at, updated_at")
    .order("name", { ascending: true });
  const secrets = (data ?? []) as SecretRow[];

  return (
    <>
        {error && (
          <p className="mb-4 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-[13px] text-[#ff8a8e]">
            Could not load secrets: {error.message}
          </p>
        )}

        <SecretsManager initial={secrets} />
    </>
  );
}
