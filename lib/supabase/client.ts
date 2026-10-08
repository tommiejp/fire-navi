"use client";

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase public environment variables are not configured.");
  }

  // The SSR helper reuses its singleton in the browser, not on the server.
  return createBrowserClient(url, key);
}
