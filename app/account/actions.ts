"use server";

import { checkRateLimit } from "@/lib/rate-limit";
import { revalidatePath } from "next/cache";
import { getAuthenticatedUser } from "@/lib/auth/user";
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

export type ProfileResult = { status: "SUCCESS" | "VALIDATION_ERROR" | "UNAUTHORIZED" | "RATE_LIMITED" | "SERVER_ERROR" };

export async function updateProfile(form: FormData): Promise<ProfileResult> {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return { status: "UNAUTHORIZED" };
    const limit = await checkRateLimit("updateProfile", user.id);
    if (limit !== "ALLOWED") return { status: limit };
    const raw = form.get("display_name");
    if (typeof raw !== "string") return { status: "VALIDATION_ERROR" };
    const display_name = raw.trim();
    if ([...display_name].length > 50) return { status: "VALIDATION_ERROR" };
    const supabase = await createClient({ writableCookies: true });
    const { data, error } = await supabase.from("profiles")
      .update({ display_name }).eq("user_id", user.id)
      .select("display_name").maybeSingle();
    // A missing row is not a successful update. Profiles are created by the DB trigger.
    if (error || !data) return { status: "SERVER_ERROR" };
    revalidatePath("/account");
    return { status: "SUCCESS" };
  } catch {
    return { status: "SERVER_ERROR" };
  }
}
