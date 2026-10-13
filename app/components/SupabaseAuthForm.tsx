"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { AUTH_ERROR, startGoogleLogin, submitCredentials, type AuthMode } from "@/lib/auth/form";

export default function SupabaseAuthForm({ mode, callbackUrl, initialError = "", unavailable = false }: {
  mode: AuthMode; callbackUrl: string; initialError?: string; unavailable?: boolean;
}) {
  const register = mode === "register";
  const [error, setError] = useState(initialError);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  async function run(form?: HTMLFormElement) {
    if (inFlight.current || unavailable) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    let navigating = false;
    try {
      const fields = form ? new FormData(form) : null;
      const result = fields
        ? await submitCredentials(mode, String(fields.get("email") ?? ""), String(fields.get("password") ?? ""), String(fields.get("confirm") ?? ""), callbackUrl)
        : await startGoogleLogin(callbackUrl);
      if (result.status === "error") setError(result.message);
      else if (result.status === "authenticated") {
        window.location.assign("/my-plan");
        navigating = true;
      } else if (result.status === "oauth") navigating = true;
      else {
        form?.reset();
        setNotice("確認メールを送信しました。届いたメールの案内に従ってください。届かない場合は迷惑メールもご確認ください。");
      }
    } catch {
      setError(AUTH_ERROR);
    } finally {
      if (!navigating) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(event.currentTarget);
  }

  const inputClass = "mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:opacity-60";
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-700 via-indigo-600 to-purple-700 px-4 py-10">
      <section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl sm:p-8" aria-labelledby="auth-title">
        <Link href="/" className="text-sm font-medium text-indigo-700 underline underline-offset-4">← FIREナビに戻る</Link>
        <h1 id="auth-title" className="mt-6 text-2xl font-bold text-gray-900">{register ? "アカウント登録" : "ログイン"}</h1>
        <p className="mt-2 text-sm text-gray-600">FIRE計算はログインなしでも利用できます。</p>
        <div id="auth-error" role="alert" className="mt-4 text-sm text-red-700">{error}</div>
        <div role="status" aria-live="polite" className="mt-2 text-sm text-indigo-800">{notice || (busy ? "処理中です…" : "")}</div>
        <form onSubmit={submit} aria-busy={busy} aria-describedby="auth-error" className="mt-5">
          <fieldset disabled={busy || unavailable} className="space-y-4">
            {!register && <>
              <button type="button" onClick={() => void run()} disabled={busy || unavailable} className="w-full rounded-xl border border-gray-300 px-4 py-3 font-medium hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50">Googleでログイン</button>
              <p className="text-center text-sm text-gray-500">またはメールアドレスでログイン</p>
            </>}
            <div><label htmlFor="email" className="text-sm font-medium">メールアドレス</label>
              <input id="email" name="email" type="email" autoComplete="email" required className={inputClass} /></div>
            <div><label htmlFor="password" className="text-sm font-medium">パスワード{register ? "（12文字以上）" : ""}</label>
              <input id="password" name="password" type="password" autoComplete={register ? "new-password" : "current-password"} minLength={register ? 12 : undefined} required className={inputClass} /></div>
            {register && <div><label htmlFor="confirm" className="text-sm font-medium">パスワード（確認）</label>
              <input id="confirm" name="confirm" type="password" autoComplete="new-password" required className={inputClass} /></div>}
            <button type="submit" disabled={busy || unavailable} className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">{busy ? "処理中…" : register ? "登録する" : "ログインする"}</button>
          </fieldset>
        </form>
        <p className="mt-6 text-center text-sm text-gray-600">{register ? "登録済みの方は " : "アカウントをお持ちでない方は "}<Link href={register ? "/login" : "/register"} className="font-medium text-indigo-700 underline underline-offset-4">{register ? "ログイン" : "新規登録"}</Link></p>
      </section>
    </main>
  );
}
