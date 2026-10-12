"use client";

import { useRef, useState, type FormEvent } from "react";
import { saveFinancialSettings, type SaveResult } from "./actions";

type Settings = { total_assets: number | string; annual_expenses: number | string; expected_return: number | string };
const messages = {
  RATE_LIMITED: "操作が多すぎます。少し待ってから再度お試しください。",
  SUCCESS: "保存しました。",
  VALIDATION_ERROR: "総資産は0以上、年間支出は1以上の整数、利回りは0〜20の数値（小数2桁まで）で入力してください。金額は安全に扱える整数の範囲内で入力してください。",
  UNAUTHORIZED: "ログインが必要です。再度ログインしてください。",
  SERVER_ERROR: "保存できませんでした。時間をおいて再度お試しください。",
};

export default function SettingsForm({ initial }: { initial: Settings | null }) {
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
      const result = await saveFinancialSettings(form);
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
      {([
        ["total_assets", "総資産（円）", "numeric"],
        ["annual_expenses", "年間支出（円）", "numeric"],
        ["expected_return", "想定利回り（%・0〜20）", "decimal"],
      ] as const).map(([name, label, inputMode]) => <div key={name}>
        <label htmlFor={name} className="text-sm font-medium">{label}</label>
        <input id={name} name={name} type="text" inputMode={inputMode} required defaultValue={initial?.[name] ?? ""}
          className="mt-2 block w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-indigo-600" />
      </div>)}
      <button type="submit" disabled={pending} className="rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white disabled:opacity-50">{pending ? "保存中…" : "保存する"}</button>
    </fieldset>
    <p role="status" aria-live="polite">{status ? messages[status] : ""}</p>
  </form>;
}
