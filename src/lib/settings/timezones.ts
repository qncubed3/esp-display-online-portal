export const DEFAULT_TIMEZONE = "Australia/Melbourne";

// IANA zones known to this runtime, plus UTC (not always listed).
export function listTimeZones(): string[] {
  const zones = new Set(Intl.supportedValuesOf("timeZone"));
  zones.add("UTC");
  return [...zones].sort();
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
