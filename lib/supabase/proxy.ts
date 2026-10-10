import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  response.headers.set("Cache-Control", "private, no-store");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  // Auth is not enabled until configured; this is not an authorization guard.
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        const previous = response;
        response = NextResponse.next({ request });
        // Preserve prior writes and cache headers if setAll runs more than once.
        previous.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
        for (const name of ["Cache-Control", "Expires", "Pragma"]) {
          const value = previous.headers.get(name);
          if (value) response.headers.set(name, value);
        }
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
        Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });

  // Verification also refreshes an expired session; never trust cookie contents.
  // An invalid/missing session does not protect a route: readers verify again.
  try {
    await supabase.auth.getClaims();
  } catch {
    // Do not log raw Auth errors (which may contain sensitive information).
    // The authenticated user helper fails closed independently.
  }
  return response;
}
