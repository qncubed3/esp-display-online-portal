"use client";

import { useActionState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { clearCache } from "@/lib/store/cache";
import { signIn, type SignInState } from "./actions";

const initial: SignInState = { error: null, email: "" };

export default function LoginForm() {
  const [state, action, pending] = useActionState(signIn, initial);

  // Signed out (from the sidebar, everywhere, or an expired session): drop the last user's cached lists.
  useEffect(() => clearCache(), []);

  return (
    <form action={action} className="space-y-4">
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={state.email} autoFocus />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {state.error && (
        <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-[13px] text-[#ff8a8e]">
          {state.error}
        </p>
      )}
      <Button type="submit" variant="primary" className="w-full" disabled={pending}>
        {pending && <Loader2 size={14} className="animate-spin" />}
        Sign in
      </Button>
    </form>
  );
}
