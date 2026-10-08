import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase public environment variables are not configured.");
  }

  const cookieStore = await cookies();
  // A fresh client for each call; never share a user's session at module scope.
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch (error) {
          // Server Components cannot write cookies. Before enabling auth,
          // add a session refresh boundary that can persist refreshed cookies.
          // Do not suppress unrelated failures in Actions / Route Handlers.
          if (
            error instanceof Error &&
            error.message.startsWith(
              "Cookies can only be modified in a Server Action or Route Handler."
            )
          ) {
            return;
          }
          throw error;
        }
      },
    },
  });
}
