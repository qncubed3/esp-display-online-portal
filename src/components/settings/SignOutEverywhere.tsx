"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import SettingsCard, { Message } from "@/components/settings/SettingsCard";
import { signOutEverywhere } from "@/lib/settings/actions";

export default function SignOutEverywhere() {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function run() {
    if (!confirm("Sign out of every browser and device, including this one?")) return;
    setError(undefined);
    startTransition(async () => {
      const res = await signOutEverywhere();
      if (res?.error) setError(res.error);
    });
  }

  return (
    <SettingsCard title="Danger zone" danger>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[13px] font-medium">Sign out everywhere</p>
          <p className="text-[13px] text-muted">Ends every session for your account, on all browsers and devices.</p>
          <Message error={error} />
        </div>
        <Button variant="danger" size="sm" onClick={run} disabled={pending} className="shrink-0">
          {pending ? "Signing out..." : "Sign out everywhere"}
        </Button>
      </div>
    </SettingsCard>
  );
}
