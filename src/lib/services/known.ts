// What a link already knew about a Service when it was clicked (client-side, in memory), so the
// service page's loading screen can show the real name and status instead of placeholders.
export interface KnownService {
  name: string;
  enabled?: boolean;
  shared?: boolean;
}

const known = new Map<string, KnownService>();

export function rememberService(id: string, service: KnownService) {
  known.set(id, service);
}

export function knownService(id: string | undefined): KnownService | undefined {
  return id ? known.get(id) : undefined;
}
