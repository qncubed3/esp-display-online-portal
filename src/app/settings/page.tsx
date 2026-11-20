import AppShell from "@/components/layout/AppShell";
import CopyText from "@/components/settings/CopyText";
import PasswordForm from "@/components/settings/PasswordForm";
import SettingsCard, { Field } from "@/components/settings/SettingsCard";
import SignOutEverywhere from "@/components/settings/SignOutEverywhere";
import TimezoneForm from "@/components/settings/TimezoneForm";
import { requireUser } from "@/lib/auth";
import { DEFAULT_TIMEZONE, listTimeZones } from "@/lib/settings/timezones";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("user_settings")
    .select("timezone")
    .eq("user_id", user.id)
    .maybeSingle();
  const timezone: string = data?.timezone ?? DEFAULT_TIMEZONE;
  const zones = listTimeZones();
  if (!zones.includes(timezone)) zones.unshift(timezone);

  return (
    <AppShell email={user.email ?? ""} crumbs={[{ label: "Settings" }]}>
      <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
        <h1 className="text-xl font-medium">Settings</h1>

        {error && (
          <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-[13px] text-[#ff8a8e]">
            Could not load settings: {error.message}
          </p>
        )}

        <SettingsCard title="Account" description="Your sign-in details.">
          <div className="divide-y divide-border">
            <Field label="Email">
              <span className="text-sm">{user.email ?? "-"}</span>
            </Field>
            <Field label="User ID">
              <CopyText value={user.id} />
            </Field>
            <Field label="Sign-in method">
              <span className="text-sm">Email and password</span>
            </Field>
          </div>
        </SettingsCard>

        <PasswordForm />

        <TimezoneForm zones={zones} saved={timezone} />

        <SignOutEverywhere />
      </div>
    </AppShell>
  );
}
