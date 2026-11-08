"use client";

import { useRef, useState, type FormEvent } from "react";
import { saveFinancialSettings, type SaveResult } from "./actions";

import { settingsInputError, type SettingsField } from "@/lib/settings-input";

type Settings = { monthly_contribution?: number | string; total_assets: number | string; annual_expenses: number | string; expected_return: number | string };
const messages = {
  RATE_LIMITED: "操作が多すぎます。少し待ってから再度お試しください。",
  SUCCESS: "保存しました。",
  VALIDATION_ERROR: "総資産・毎月の積立額は0以上、年間支出は1以上の整数、利回りは0〜20の数値（小数2桁まで）で入力してください。金額は安全に扱える整数の範囲内で入力してください。",
  UNAUTHORIZED: "ログインが必要です。再度ログインしてください。",
  SERVER_ERROR: "保存できませんでした。時間をおいて再度お試しください。",
};

export default function SettingsForm({ initial }: { initial: Settings | null }) {
  const [status, setStatus] = useState<SaveResult["status"] | null>(null);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<SettingsField, string>>>({});
  const submitting = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const element = event.currentTarget;
    const form = new FormData(element);
    const nextErrors: Partial<Record<SettingsField, string>> = {};
    for (const name of ["total_assets", "annual_expenses", "monthly_contribution", "expected_return"] as const) {
      const error = settingsInputError(name, String(form.get(name) ?? ""));
      if (error) nextErrors[name] = error;
    }
    setErrors(nextErrors);
    setStatus(null);
    const firstError = Object.keys(nextErrors)[0];
    if (firstError) {
      element.querySelector<HTMLInputElement>(`[name="${firstError}"]`)?.focus();
      return;
    }
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
  return <form noValidate onSubmit={submit} aria-busy={pending} className="mt-6 space-y-4">
    <p className="text-sm text-gray-600">すべて必須です。金額は万円単位ではなく円で入力してください（例：100万円 → 1000000）。保存後に進捗・予測へ反映されます。</p>
    {Object.values(errors).some(Boolean) && <p role="alert" className="text-sm text-red-700">入力内容を確認してください。各項目の下に修正方法を表示しています。</p>}
    <fieldset disabled={pending} className="space-y-4">
      {([
        ["total_assets", "総資産（円）", "numeric", "現在保有している資産の合計。資産がない場合は0を入力します。"],
        ["annual_expenses", "年間支出（円）", "numeric", "1年間の生活費の合計。月20万円なら2400000円です。"],
        ["monthly_contribution", "毎月の積立額（円）", "numeric", "毎月末に追加で運用する金額。積立しない場合は0を入力します。"],
        ["expected_return", "想定利回り（%・0〜20）", "decimal", "1年間の想定利回り。年5%なら5を入力します。将来の成果を保証する値ではありません。"],
      ] as const).map(([name, label, inputMode, hint]) => <div key={name}>
        <label htmlFor={name} className="text-sm font-medium">{label}</label>
        <input id={name} name={name} type="text" inputMode={inputMode} required
          aria-invalid={Boolean(errors[name])} aria-describedby={`${name}-hint${errors[name] ? ` ${name}-error` : ""}`}
          onBlur={event => setErrors(previous => ({ ...previous, [name]: settingsInputError(name, event.target.value) }))}
          onChange={event => {
            setStatus(null);
            if (errors[name]) {
              const error = settingsInputError(name, event.target.value);
              setErrors(previous => {
                const next = { ...previous };
                if (error) next[name] = error; else delete next[name];
                return next;
              });
            }
          }} defaultValue={initial?.[name] ?? (name === "monthly_contribution" ? 0 : "")}
          className="mt-2 block w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-indigo-600" />
        <p id={`${name}-hint`} className="mt-2 text-sm text-gray-600">{hint}</p>
        {errors[name] && <p id={`${name}-error`} className="mt-1 text-sm text-red-700">{errors[name]}</p>}
      </div>)}
      <button type="submit" disabled={pending} className="min-h-11 w-full sm:w-auto rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white disabled:opacity-50">{pending ? "保存中…" : "保存する"}</button>
    </fieldset>
    <p role="status" aria-live="polite">{status ? messages[status] : ""}</p>
  </form>;
}
