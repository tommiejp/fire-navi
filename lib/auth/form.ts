import { createClient } from "@/lib/supabase/client";

export type AuthMode = "login" | "register";
export const AUTH_ERROR = "認証できませんでした。入力内容を確認し、時間をおいて再度お試しください。";
export type AuthResult = { status: "error"; message: string } | { status: "authenticated" | "confirmation" | "oauth" };

export async function submitCredentials(mode: AuthMode, email: string, password: string, confirm: string, callbackUrl: string): Promise<AuthResult> {
  const address = email.trim();
  if (!address || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
    return { status: "error", message: "正しいメールアドレスを入力してください。" };
  }
  if (!password) return { status: "error", message: "パスワードを入力してください。" };
  if (mode === "register") {
    if ([...password].length < 12) return { status: "error", message: "パスワードは12文字以上で入力してください。" };
    if (password !== confirm) return { status: "error", message: "確認用パスワードが一致しません。" };
  }
  try {
    const supabase = createClient();
    const { data, error } = mode === "register"
      ? await supabase.auth.signUp({ email: address, password, options: { emailRedirectTo: callbackUrl } })
      : await supabase.auth.signInWithPassword({ email: address, password });
    if (error) return { status: "error", message: AUTH_ERROR };
    if (data.session) return { status: "authenticated" };
    return mode === "register" ? { status: "confirmation" } : { status: "error", message: AUTH_ERROR };
  } catch {
    return { status: "error", message: AUTH_ERROR };
  }
}

export async function startGoogleLogin(callbackUrl: string): Promise<AuthResult> {
  try {
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google", options: { redirectTo: callbackUrl },
    });
    return error ? { status: "error", message: AUTH_ERROR } : { status: "oauth" };
  } catch {
    return { status: "error", message: AUTH_ERROR };
  }
}
