"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LogoutResult = { status: "SERVER_ERROR" };

export async function logout(): Promise<LogoutResult> {
  try {
    const supabase = await createClient({ writableCookies: true });
    // Sign out this session; do not end sessions on other devices.
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) return { status: "SERVER_ERROR" };
  } catch {
    return { status: "SERVER_ERROR" };
  }
  // Next.js redirect throws; do not catch the successful redirect.
  redirect("/");
}
