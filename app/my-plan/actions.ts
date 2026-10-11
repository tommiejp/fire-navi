"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";

export type SaveResult = { status: "SUCCESS" | "VALIDATION_ERROR" | "UNAUTHORIZED" | "SERVER_ERROR" };

function amount(value: FormDataEntryValue | null, minimum: number): number | null {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= minimum ? number : null;
}

export async function saveFinancialSettings(form: FormData): Promise<SaveResult> {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return { status: "UNAUTHORIZED" };
    const total_assets = amount(form.get("total_assets"), 0);
    const annual_expenses = amount(form.get("annual_expenses"), 1);
    const rawReturn = form.get("expected_return");
    // NUMERIC(5,2): reject excess precision instead of silently rounding it.
    const expected_return = typeof rawReturn === "string" && /^\d+(\.\d{1,2})?$/.test(rawReturn)
      ? Number(rawReturn) : NaN;
    if (total_assets === null || annual_expenses === null || !Number.isFinite(expected_return) || expected_return < 0 || expected_return > 20) {
      return { status: "VALIDATION_ERROR" };
    }
    const supabase = await createClient({ writableCookies: true });
    const { error } = await supabase.from("user_financial_settings").upsert({
      user_id: user.id, total_assets, annual_expenses, expected_return,
    }, { onConflict: "user_id" });
    if (error) return { status: "SERVER_ERROR" };
    revalidatePath("/my-plan");
    return { status: "SUCCESS" };
  } catch {
    return { status: "SERVER_ERROR" };
  }
}

export async function recordCurrentAssets(form: FormData): Promise<SaveResult> {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return { status: "UNAUTHORIZED" };
    const total_assets = amount(form.get("total_assets"), 0);
    if (total_assets === null) return { status: "VALIDATION_ERROR" };
    const supabase = await createClient({ writableCookies: true });
    // Ownership comes only from Auth; the database supplies id and recorded_at.
    const { error } = await supabase.from("asset_history").insert({
      user_id: user.id, total_assets,
    });
    return { status: error ? "SERVER_ERROR" : "SUCCESS" };
  } catch {
    return { status: "SERVER_ERROR" };
  }
}
