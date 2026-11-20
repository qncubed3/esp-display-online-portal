import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Skip static assets and the device API (ESP32s authenticate with a device key, not a cookie).
  // sw.js and the manifest must load without a session (browsers fetch them without redirects/cookies).
  matcher: [
    "/((?!api/device|_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
