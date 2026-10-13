"use client";

import { useRef, useState, type FormEvent } from "react";
import { updateProfile, type ProfileResult } from "./actions";

const messages = {
  RATE_LIMITED: "操作が多すぎます。少し待ってから再度お試しください。",
  SUCCESS: "表示名を保存しました。",
  VALIDATION_ERROR: "表示名は50文字以下で入力してください。",
  UNAUTHORIZED: "ログインが必要です。再度ログインしてください。",
  SERVER_ERROR: "保存できませんでした。時間をおいて再度お試しください。",
};

export default function ProfileForm({ initialName }: { initialName: string }) {
  const [status, setStatus] = useState<ProfileResult["status"] | null>(null);
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const form = new FormData(event.currentTarget);
    submitting.current = true;
    setPending(true);
    setStatus(null);
    try {
      const result = await updateProfile(form);
      setStatus(result.status);
    } catch {
      setStatus("SERVER_ERROR");
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }
  return <form onSubmit={submit} aria-busy={pending} className="mt-6 space-y-4">
    <fieldset disabled={pending} className="space-y-4">
      <div>
        <label htmlFor="display-name" className="text-sm font-medium">表示名（50文字まで）</label>
        <input id="display-name" name="display_name" type="text" autoComplete="nickname" defaultValue={initialName}
          className="mt-2 block w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-indigo-600" />
      </div>
      <button type="submit" disabled={pending} className="rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white disabled:opacity-50">{pending ? "保存中…" : "保存する"}</button>
    </fieldset>
    <p role="status" aria-live="polite">{status ? messages[status] : ""}</p>
  </form>;
}
