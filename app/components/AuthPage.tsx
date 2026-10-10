import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth/user";
import SupabaseAuthForm from "./SupabaseAuthForm";
import type { AuthMode } from "@/lib/auth/form";

export default async function AuthPage({ mode, callbackFailed = false }: { mode: AuthMode; callbackFailed?: boolean }) {
  let user = null;
  let unavailable = false;
  let callbackUrl = "";
  try {
    user = await getAuthenticatedUser();
    // Same trusted configuration as the existing callback; never use query/Host input.
    const origin = new URL(process.env.APP_ORIGIN || "https://fire-navi.vercel.app");
    if (origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash ||
      (origin.protocol !== "https:" && !(origin.protocol === "http:" && ["localhost", "127.0.0.1"].includes(origin.hostname)))) {
      throw new Error("Invalid configuration");
    }
    callbackUrl = new URL("/auth/callback", origin).toString();
  } catch {
    unavailable = true;
  }
  // redirect throws; keep it outside the error handler.
  if (user) redirect("/my-plan");
  return <SupabaseAuthForm mode={mode} callbackUrl={callbackUrl} unavailable={unavailable}
    initialError={unavailable ? "現在認証を利用できません。時間をおいて再度お試しください。" : callbackFailed ? "認証できませんでした。もう一度お試しください。" : ""} />;
}
