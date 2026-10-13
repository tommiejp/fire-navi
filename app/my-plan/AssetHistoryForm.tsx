"use client";

import { useRef, useState, type FormEvent } from "react";
import { recordCurrentAssets, type SaveResult } from "./actions";

const messages = {
  RATE_LIMITED: "操作が多すぎます。少し待ってから再度お試しください。",
  SUCCESS: "資産を履歴に記録しました。",
  VALIDATION_ERROR: "総資産は0〜9,007,199,254,740,991円の整数で入力してください。",
  UNAUTHORIZED: "ログインが必要です。再度ログインしてください。",
  SERVER_ERROR: "記録できませんでした。時間をおいて再度お試しください。",
};

export default function AssetHistoryForm({ initialAssets }: { initialAssets: number | string | null }) {
  const [status, setStatus] = useState<SaveResult["status"] | null>(null);
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
      const result = await recordCurrentAssets(form);
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
        <label htmlFor="history-total-assets" className="text-sm font-medium">総資産（円）</label>
        <input id="history-total-assets" name="total_assets" type="text" inputMode="numeric" required defaultValue={initialAssets ?? ""}
          className="mt-2 block w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-indigo-600" />
      </div>
      <button type="submit" disabled={pending} className="rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white disabled:opacity-50">{pending ? "記録中…" : "記録する"}</button>
    </fieldset>
    <p role="status" aria-live="polite">{status ? messages[status] : ""}</p>
  </form>;
}
