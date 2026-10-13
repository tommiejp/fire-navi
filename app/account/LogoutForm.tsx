"use client";

import { useActionState } from "react";
import { logout } from "./actions";

export default function LogoutForm() {
  const [result, action, pending] = useActionState(logout, null);
  return <form action={action} aria-busy={pending} className="mt-6">
    <button type="submit" disabled={pending} className="rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white disabled:opacity-50">
      {pending ? "ログアウト中…" : "ログアウト"}
    </button>
    <p role="alert" className="mt-3 text-sm text-red-700">{result ? "ログアウトできませんでした。時間をおいて再度お試しください。" : ""}</p>
  </form>;
}
