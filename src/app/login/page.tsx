import { Monitor } from "lucide-react";
import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="flex min-h-full items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-md border border-border bg-panel p-6">
        <div className="mb-6 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent/15 text-accent">
            <Monitor size={16} />
          </span>
          <span className="text-sm font-medium">ESP Display Portal</span>
        </div>
        <h1 className="mb-1 text-lg font-medium">Sign in</h1>
        <p className="mb-6 text-[13px] text-muted">Use the account your administrator created for you.</p>
        <LoginForm />
      </div>
    </main>
  );
}
