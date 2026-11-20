"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button, Input, Label } from "@/components/ui";
import SettingsCard, { Message } from "@/components/settings/SettingsCard";
import { changePassword, type SettingsResult } from "@/lib/settings/actions";

const initial: SettingsResult = {};

export default function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action}>
      <SettingsCard
        title="Change password"
        description="At least 8 characters. Supabase may ask you to sign in again first if your session is old."
        footer={
          <>
            <Message error={state.error} success={state.ok ? "Password updated." : undefined} />
            <Button type="submit" variant="primary" size="sm" disabled={pending}>
              {pending ? "Updating..." : "Update password"}
            </Button>
          </>
        }
      >
        <div className="grid max-w-md gap-3">
          <div>
            <Label htmlFor="password">New password</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
          </div>
          <div>
            <Label htmlFor="confirm">Confirm new password</Label>
            <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
          </div>
        </div>
      </SettingsCard>
    </form>
  );
}
