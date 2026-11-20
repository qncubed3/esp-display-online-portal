// Secret name rules, shared by the Secrets form (client) and the server actions.
// Mirrors the user_secrets.name check constraint in supabase/migrations/003_secrets_and_settings.sql.

export const SECRET_NAME_RE = /^[A-Z][A-Z0-9_]{0,63}$/;
export const MAX_SECRET_VALUE_LENGTH = 4096;

// What the name field holds as the user types: uppercase, spaces/dashes become underscores,
// anything else outside A-Z 0-9 _ dropped, capped at 64 chars.
export function normalizeSecretName(input: string): string {
  return input
    .toUpperCase()
    .replace(/[\s-]/g, "_")
    .replace(/[^A-Z0-9_]/g, "")
    .slice(0, 64);
}

// A user-facing problem with the name, or null when it is valid.
export function secretNameError(name: string): string | null {
  if (!name) return "Name is required.";
  if (!/^[A-Z]/.test(name)) return "Name must start with a letter A-Z.";
  if (!SECRET_NAME_RE.test(name)) return "Use only A-Z, 0-9 and _ (at most 64 characters).";
  return null;
}

export function secretValueError(value: string): string | null {
  if (!value) return "Value is required.";
  if (value.length > MAX_SECRET_VALUE_LENGTH) return `Value must be at most ${MAX_SECRET_VALUE_LENGTH} characters.`;
  return null;
}
