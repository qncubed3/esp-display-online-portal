"use client";

import { LogOut } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import { clearCache } from "@/lib/store/cache";

// Sidebar sign-out. Clears the client cache as the form submits, so the next user of this browser
// doesn't see this one's Services and devices.
export default function SignOutButton() {
  return (
    <form action={signOut} onSubmit={() => clearCache()}>
      <button
        type="submit"
        className="flex h-7 w-full cursor-pointer items-center gap-2 rounded-md px-2 text-[13px] text-muted transition-colors hover:bg-panel-hover hover:text-fg"
      >
        <LogOut size={14} />
        Sign out
      </button>
    </form>
  );
}
