import { Suspense } from "react";
import AppShell from "@/components/layout/AppShell";
import CopyText from "@/components/settings/CopyText";
import PasswordForm from "@/components/settings/PasswordForm";
import SettingsCard, { Field } from "@/components/settings/SettingsCard";
import SignOutEverywhere from "@/components/settings/SignOutEverywhere";
import TimezoneForm from "@/components/settings/TimezoneForm";
import { Skeleton } from "@/components/ui/Skeleton";
import { requireUser } from "@/lib/auth";
import { DEFAULT_TIMEZONE, listTimeZones } from "@/lib/settings/timezones";

export const metadata = { title: "Settings" };

// Card titles and the forms that need no data render straight away; account details and the
// saved time zone stream in.
export default function SettingsPage() {
  return (
    <AppShell crumbs={[{ label: "Settings" }]}>
      <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
        <h1 className="text-xl font-medium">Settings</h1>

        <SettingsCard title="Account" description="Your sign-in details.">
          <div className="divide-y divide-border">
            <Suspense
              fallback={
                <>
                  <Field label="Email">
                    <Skeleton className="w-48" />
                  </Field>
                  <Field label="User ID">
                    <Skeleton className="w-64" />
                  </Field>
                </>
              }
            >
              <AccountFields />
            </Suspense>
            <Field label="Sign-in method">
              <span className="text-sm">Email and password</span>
            </Field>
          </div>
        </SettingsCard>

        <PasswordForm />

        <Suspense
          fallback={
            <SettingsCard
              title="Time zone"
              description={
                <>
                  Used by <code className="font-mono text-[12px] text-fg">now()</code> in your Services&apos; Data code.
                </>
              }
            >
              <Skeleton className="h-8 w-full max-w-md rounded-md" />
            </SettingsCard>
          }
        >
          <TimezoneSection />
        </Suspense>

        <SignOutEverywhere />
      </div>
    </AppShell>
  );
}

async function AccountFields() {
  const { user } = await requireUser();
  return (
    <>
      <Field label="Email">
        <span className="text-sm">{user.email ?? "-"}</span>
      </Field>
      <Field label="User ID">
        <CopyText value={user.id} />
      </Field>
    </>
  );
}

async function TimezoneSection() {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase.from("user_settings").select("timezone").eq("user_id", user.id).maybeSingle();
  const timezone: string = data?.timezone ?? DEFAULT_TIMEZONE;
  const zones = listTimeZones();
  if (!zones.includes(timezone)) zones.unshift(timezone);

  return (
    <>
      {error && (
        <p className="mb-3 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-[13px] text-[#ff8a8e]">
          Could not load settings: {error.message}
        </p>
      )}
      <TimezoneForm zones={zones} saved={timezone} />
    </>
  );
}
