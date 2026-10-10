import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server Components use the read-only default. Actions / Route Handlers must
// explicitly opt in to writes. Route Handlers must pass their response headers.
export async function createClient(
  options: { writableCookies?: boolean; responseHeaders?: Headers } = {}
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase public environment variables are not configured.");
  }
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet, headers) {
        // Proxy persists refreshed sessions before Server Components render.
        if (!options.writableCookies) return;
        cookiesToSet.forEach(({ name, value, options: cookieOptions }) => {
          cookieStore.set(name, value, cookieOptions);
        });
        Object.entries(headers).forEach(([name, value]) => {
          options.responseHeaders?.set(name, value);
        });
      },
    },
  });
}
