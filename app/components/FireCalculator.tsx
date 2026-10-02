"use client";

import { useEffect, useState } from "react";
import AssetChart from "./AssetChart";
import { calculateFire, DEFAULT_DATA, isValidFireData, parseAmount, restoreFireData, STORAGE_KEY } from "../../lib/fire";

export function formatCurrency(amount: number): string {
  if (amount >= 100_000_000) {
    const oku = amount / 100_000_000;
    return `${oku % 1 === 0 ? oku.toFixed(0) : oku.toFixed(1)}億円`;
  }
  if (amount >= 10_000) {
    return `${Math.round(amount / 10_000).toLocaleString()}万円`;
  }
  return `${amount.toLocaleString()}円`;
}


function AmountInput({ id, label, value, onChange, error, hint }: {
  id: string; label: string; value: string; onChange: (value: string) => void;
  error: string | null; hint?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <div className="relative">
        <input id={id} type="text" inputMode="numeric" value={value}
          onChange={(e) => onChange(e.target.value)} aria-invalid={!!error}
          aria-describedby={`${id}-help`} autoComplete="off" spellCheck={false}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-10 text-gray-900 text-right text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50" />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">円</span>
      </div>
      <p id={`${id}-help`} className={`text-xs mt-1 text-right ${error ? "text-red-600" : "text-indigo-500"}`}>{error || hint}</p>
    </div>
  );
}

export default function FireCalculator() {
  const [assets, setAssets] = useState(String(DEFAULT_DATA.total_assets));
  const [spending, setSpending] = useState(String(DEFAULT_DATA.annual_spending));
  const [rate, setRate] = useState(DEFAULT_DATA.return_rate);
  const [hydrated, setHydrated] = useState(false);
  const [edited, setEdited] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState("");
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved !== null) {
        const restored = restoreFireData(saved);
        if (restored) {
          setAssets(String(restored.total_assets));
          setSpending(String(restored.annual_spending));
          setRate(restored.return_rate);
        } else {
          setRestoreMessage("保存された入力を読み込めなかったため、初期値を表示しています。入力を確認してください。");
        }
      }
    } catch {
      setSaveFailed(true);
    }
    setHydrated(true);
  }, []);

  const assetInput = parseAmount(assets, false);
  const spendingInput = parseAmount(spending, true);
  const candidate = { total_assets: assetInput.value, annual_spending: spendingInput.value, return_rate: rate };
  const data = isValidFireData(candidate) ? candidate : null;
  const result = data ? calculateFire(data) : null;
  const rateError = !Number.isFinite(rate) || rate < 0.03 || rate > 0.07;

  useEffect(() => {
    // 復元前・無効な編集中の値を保存しない。既存の他機能のキーも触らない。
    if (!hydrated || !edited) return;
    const a = parseAmount(assets, false);
    const s = parseAmount(spending, true);
    const value = { total_assets: a.value, annual_spending: s.value, return_rate: rate };
    if (!isValidFireData(value)) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      setSaveFailed(false);
      setRestoreMessage("");
    } catch { setSaveFailed(true); }
  }, [assets, spending, rate, hydrated, edited]);

  if (!hydrated) return <p className="py-20 text-center text-gray-500">読み込み中…</p>;
  const progress = data && result ? Math.min(100, Math.round(data.total_assets / result.fireTarget * 100)) : 0;

  return (
    <div className="space-y-4">
      {restoreMessage && <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{restoreMessage}</p>}
      {result && data ? (
        <section aria-label="計算結果" className={`rounded-2xl p-5 text-white bg-gradient-to-br ${result.yearsToFire === 0 ? "from-emerald-600 to-emerald-500" : "from-indigo-700 to-indigo-500"} shadow-md`}>
          <p className="text-sm mb-1">{result.yearsToFire === 0 ? "目標資産への到達" : "FIREまであと（目安）"}</p>
          {result.yearsToFire === null ? <p className="text-2xl font-black">60年以内では未到達</p>
            : result.yearsToFire === 0 ? <><p className="text-3xl font-black">目標資産に到達（0年）</p><p className="text-sm mt-2">現在の資産は、4%ルールに基づく目標資産額に到達しています。</p></>
            : <p className="text-4xl font-black">{result.yearsToFire}<span className="text-2xl ml-1">年</span></p>}
          <div className="bg-black/10 rounded-xl p-3 mt-4">
            <div className="flex justify-between text-xs mb-2"><span>達成率</span><span>{progress}%</span></div>
            <div className="w-full bg-black/10 rounded-full h-2 overflow-hidden"><div className="h-2 rounded-full bg-white" style={{ width: `${progress}%` }} /></div>
            <div className="flex justify-between gap-3 text-xs mt-2"><p>現在の資産<br /><strong className="text-sm">{formatCurrency(data.total_assets)}</strong></p><p className="text-right">FIRE目標<br /><strong className="text-sm">{formatCurrency(result.fireTarget)}</strong></p></div>
          </div>
        </section>
      ) : <p role="alert" className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">入力内容を確認してください。正しい値を入力すると計算結果が表示されます。</p>}

      <p className="text-xs text-gray-600 leading-relaxed px-1">この結果は、入力した資産全額を一定利回りで運用し、追加積立・途中の取り崩しをしない場合の概算です。税金・手数料・インフレ・利回りの変動は考慮していません。4%ルールは目標資産の目安であり、FIRE達成や将来の運用成果を保証するものではありません。</p>

      <section className="bg-white rounded-2xl p-5 shadow-sm space-y-5">
        <h2 className="text-sm font-bold text-gray-800">📝 資産情報を入力</h2>
        <AmountInput id="total-assets" label="総資産" value={assets} onChange={(v) => { setAssets(v); setEdited(true); }} error={assetInput.error} hint={assetInput.value !== null ? formatCurrency(assetInput.value) : undefined} />
        <AmountInput id="annual-spending" label="年間支出" value={spending} onChange={(v) => { setSpending(v); setEdited(true); }} error={spendingInput.error} hint={spendingInput.value !== null ? formatCurrency(spendingInput.value) : undefined} />
        <div>
          <div className="flex justify-between items-center mb-2"><label htmlFor="return-rate" className="text-sm font-medium text-gray-700">年間利回り</label><span className="text-xl font-black text-indigo-600">{(rate * 100).toFixed(1)}%</span></div>
          <input id="return-rate" type="range" min={0.03} max={0.07} step={0.001} value={rate} onChange={(e) => { setRate(Number(e.target.value)); setEdited(true); }} className="w-full focus-visible:outline-2 focus-visible:outline-indigo-600" aria-invalid={rateError} />
          <div className="flex justify-between text-xs text-gray-500 mt-1.5"><span>3%</span><span>5%</span><span>7%</span></div>
          {rateError && <p className="text-xs text-red-600">利回りは3〜7%で入力してください。</p>}
        </div>
        <p className="text-xs text-gray-500">金額は半角数字・円単位の整数（1兆円以下）で入力してください。</p>
        <p className="text-xs text-gray-600 leading-relaxed">入力データはこのブラウザ内に保存されます。別端末への同期・バックアップは行われません。無効な入力は保存されず、再読み込み時は最後の有効な入力に戻ります。</p>
        {saveFailed && <p role="status" className="text-xs text-amber-800">このブラウザでは入力を保存できません。計算はそのまま利用できます。</p>}
      </section>

      {result && data && <>
        <div className="grid grid-cols-2 gap-3">
          <SummaryCard label="FIRE目標資産" value={formatCurrency(result.fireTarget)} icon="🎯" />
          <SummaryCard label="目標までの不足額" value={formatCurrency(Math.max(0, result.fireTarget - data.total_assets))} icon="📉" />
        </div>
        <section className="bg-white rounded-2xl p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-800 mb-1">📈 資産推移シミュレーション</h2>
          <p className="text-xs text-gray-500 mb-4">利回り {(rate * 100).toFixed(1)}% で複利運用した場合の推移</p>
          <AssetChart data={result.simulation} formatCurrency={formatCurrency} />
        </section>
        <section className="bg-white rounded-2xl p-5 shadow-sm space-y-2.5">
          <h2 className="text-sm font-bold text-gray-800">📐 計算ロジック</h2>
          <FormulaRow label="FIRE必要資産" formula="年間支出 ÷ 4%（4%ルール）" result={formatCurrency(result.fireTarget)} />
          <FormulaRow label="毎年の資産成長" formula="資産 × (1 + 利回り)" result="複利計算" />
        </section>
      </>}
    </div>
  );
}

function SummaryCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="bg-white rounded-2xl p-3.5 shadow-sm text-center">
      <p className="text-lg mb-1">{icon}</p>
      <p className="text-[10px] text-gray-500 leading-tight mb-1">{label}</p>
      <p className="text-xs font-bold text-gray-900 leading-tight break-words">{value}</p>
    </div>
  );
}

function FormulaRow({ label, formula, result }: { label: string; formula: string; result: string }) {
  return (
    <div className="flex items-start justify-between gap-2 text-xs border-b border-gray-50 pb-2 last:border-0 last:pb-0">
      <div className="flex-1">
        <p className="font-medium text-gray-700">{label}</p>
        <p className="text-gray-400 mt-0.5">{formula}</p>
      </div>
      <p className="font-bold text-indigo-600 text-right flex-shrink-0">{result}</p>
    </div>
  );
}
