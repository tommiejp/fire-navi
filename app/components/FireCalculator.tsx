"use client";

/**
 * FireCalculator（コンテンツのみ）
 * ─────────────────────────────────────────────────────
 * FIREシミュレーターのメインコンテンツ。
 * ヘッダー・ナビゲーションは DashboardShell が担う。
 *
 * 機能：
 *   - 総資産・年間支出・利回りの入力
 *   - FIRE必要資産の計算（4%ルール）
 *   - 最大60年の資産シミュレーション
 *   - 結果のリアルタイム反映
 *   - localStorageへの自動保存・復元
 */

import { useState, useEffect } from "react";
import AssetChart, { SimulationPoint } from "./AssetChart";

// ─── 型定義 ────────────────────────────────────────────
interface FireData {
  total_assets: number;    // 総資産（円）
  annual_spending: number; // 年間支出（円）
  return_rate: number;     // 年間利回り（0.03〜0.07）
}

// ─── 定数 ──────────────────────────────────────────────
const STORAGE_KEY = "fire_navi_v1";

// 初期値
const DEFAULT_DATA: FireData = {
  total_assets: 5_000_000,
  annual_spending: 3_000_000,
  return_rate: 0.05,
};

// ─── FIRE計算ロジック ─────────────────────────────────
function calculateFire(data: FireData): {
  fireTarget: number;
  yearsToFire: number | null;
  simulation: SimulationPoint[];
} {
  const { total_assets, annual_spending, return_rate } = data;

  // FIRE必要資産 = 年間支出 ÷ 4%（安全引出率）
  const fireTarget = Math.round(annual_spending / 0.04);

  const simulation: SimulationPoint[] = [];
  let currentAssets = total_assets;
  let yearsToFire: number | null = null;

  simulation.push({ year: 0, assets: currentAssets, target: fireTarget });

  if (currentAssets >= fireTarget) {
    yearsToFire = 0;
  } else {
    for (let year = 1; year <= 60; year++) {
      currentAssets = Math.round(currentAssets * (1 + return_rate));
      simulation.push({ year, assets: currentAssets, target: fireTarget });
      if (yearsToFire === null && currentAssets >= fireTarget) {
        yearsToFire = year;
        break;
      }
    }
  }

  return { fireTarget, yearsToFire, simulation };
}

// ─── 金額フォーマット ─────────────────────────────────
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

// ─── 数値入力コンポーネント ────────────────────────────
interface NumberInputProps {
  label: string;
  value: number;
  onChange: (val: number) => void;
  step?: number;
  min?: number;
  hint?: string;
}

function NumberInput({ label, value, onChange, step = 100_000, min = 0, hint }: NumberInputProps) {
  const [raw, setRaw] = useState<string>(String(value));

  useEffect(() => { setRaw(String(value)); }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const str = e.target.value;
    setRaw(str);
    const parsed = parseInt(str.replace(/,/g, ""), 10);
    if (!isNaN(parsed)) onChange(Math.max(min, parsed));
  };

  const handleBlur = () => {
    const parsed = parseInt(raw.replace(/,/g, ""), 10);
    if (isNaN(parsed) || parsed < min) { onChange(min); setRaw(String(min)); }
    else { onChange(parsed); setRaw(String(parsed)); }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <div className="relative">
        <input
          type="number"
          value={raw}
          onChange={handleChange}
          onBlur={handleBlur}
          step={step}
          min={min}
          inputMode="numeric"
          className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-10 text-gray-900 text-right text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 hover:bg-white transition-colors"
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">円</span>
      </div>
      {hint && <p className="text-xs text-indigo-500 mt-1 text-right font-medium">{hint}</p>}
    </div>
  );
}

// ─── メインコンポーネント ──────────────────────────────
export default function FireCalculator() {
  const [data, setData] = useState<FireData>(DEFAULT_DATA);
  const [isHydrated, setIsHydrated] = useState(false);

  // localStorage 復元
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: FireData = JSON.parse(saved);
        if (
          typeof parsed.total_assets === "number" &&
          typeof parsed.annual_spending === "number" &&
          typeof parsed.return_rate === "number"
        ) {
          setData(parsed);
        }
      }
    } catch { /* ignore */ }
    setIsHydrated(true);
  }, []);

  // localStorage 自動保存
  useEffect(() => {
    if (!isHydrated) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* ignore */ }
  }, [data, isHydrated]);

  const handleChange = <K extends keyof FireData>(key: K, value: FireData[K]) => {
    setData((prev) => ({ ...prev, [key]: value }));
  };

  const { fireTarget, yearsToFire, simulation } = calculateFire(data);
  const progressPct = Math.min(100, Math.round((data.total_assets / fireTarget) * 100));

  if (!isHydrated) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-400 text-sm animate-pulse">読み込み中…</p>
      </div>
    );
  }

  const heroBg = yearsToFire === 0 ? "from-emerald-600 to-emerald-500" : "from-indigo-700 to-indigo-500";

  return (
    <div className="space-y-4">

      {/* ① FIRE結果ヒーローカード */}
      <div className={`rounded-2xl p-5 text-white bg-gradient-to-br ${heroBg} shadow-md`}>
        <div className="mb-4">
          <p className="text-indigo-200 text-xs font-medium tracking-wide uppercase mb-0.5">
            {yearsToFire === 0 ? "ステータス" : "FIREまであと"}
          </p>
          {yearsToFire === null ? (
            <div>
              <p className="text-4xl font-black tracking-tight">60年以上</p>
              <p className="text-indigo-200 text-xs mt-0.5">利回りや貯蓄額を見直してみましょう</p>
            </div>
          ) : yearsToFire === 0 ? (
            <div>
              <p className="text-4xl font-black tracking-tight">🎉 FIRE達成！</p>
              <p className="text-emerald-100 text-xs mt-0.5">おめでとうございます。今すぐFIRE可能です</p>
            </div>
          ) : (
            <div>
              <p className="text-4xl font-black tracking-tight">
                {yearsToFire}<span className="text-2xl font-bold ml-1">年</span>
              </p>
              <p className="text-indigo-200 text-xs mt-0.5">
                {new Date().getFullYear() + yearsToFire}年頃にFIRE達成見込み
              </p>
            </div>
          )}
        </div>

        {/* 達成率バー */}
        <div className="bg-indigo-900/40 rounded-xl p-3">
          <div className="flex justify-between text-xs mb-2">
            <span className="text-indigo-200">達成率</span>
            <span className="text-white font-bold">{progressPct}%</span>
          </div>
          <div className="w-full bg-indigo-900/50 rounded-full h-2 overflow-hidden">
            <div className="h-2 rounded-full bg-white transition-all duration-500 ease-out" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="flex justify-between text-xs mt-2">
            <div>
              <span className="text-indigo-300">現在の資産</span><br />
              <span className="text-white font-semibold text-sm">{formatCurrency(data.total_assets)}</span>
            </div>
            <div className="text-right">
              <span className="text-indigo-300">FIRE目標</span><br />
              <span className="text-white font-semibold text-sm">{formatCurrency(fireTarget)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ② 入力フォーム */}
      <div className="bg-white rounded-2xl p-5 shadow-sm space-y-5">
        <h2 className="text-sm font-bold text-gray-800">📝 資産情報を入力</h2>
        <NumberInput label="総資産" value={data.total_assets} onChange={(v) => handleChange("total_assets", v)} step={500_000} hint={formatCurrency(data.total_assets)} />
        <NumberInput label="年間支出" value={data.annual_spending} onChange={(v) => handleChange("annual_spending", Math.max(1, v))} step={100_000} min={1} hint={formatCurrency(data.annual_spending)} />
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-medium text-gray-700">年間利回り</label>
            <div className="text-right">
              <span className="text-xl font-black text-indigo-600">{(data.return_rate * 100).toFixed(1)}</span>
              <span className="text-sm font-bold text-indigo-500 ml-0.5">%</span>
            </div>
          </div>
          <input
            type="range" min={0.03} max={0.07} step={0.001} value={data.return_rate}
            onChange={(e) => handleChange("return_rate", parseFloat(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-[11px] text-gray-400 mt-1.5">
            <span>3%（安定）</span><span>5%（標準）</span><span>7%（積極）</span>
          </div>
        </div>
      </div>

      {/* ③ サマリーカード */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard label="FIRE目標資産" value={formatCurrency(fireTarget)} icon="🎯" />
        <SummaryCard label="不足額" value={data.total_assets >= fireTarget ? "達成済み ✅" : formatCurrency(fireTarget - data.total_assets)} icon="📉" />
        <SummaryCard label="年間引出可能額" value={formatCurrency(Math.round(data.total_assets * 0.04))} icon="💸" />
      </div>

      {/* ④ 資産推移グラフ */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <h2 className="text-sm font-bold text-gray-800 mb-1">📈 資産推移シミュレーション</h2>
        <p className="text-[11px] text-gray-400 mb-4">
          利回り {(data.return_rate * 100).toFixed(1)}% で複利運用した場合の推移
        </p>
        <AssetChart data={simulation} formatCurrency={formatCurrency} />
      </div>

      {/* ⑤ 計算ロジック */}
      <div className="bg-white rounded-2xl p-5 shadow-sm space-y-2.5">
        <h2 className="text-sm font-bold text-gray-800">📐 計算ロジック</h2>
        <FormulaRow label="FIRE必要資産" formula="年間支出 ÷ 4%（4%ルール）" result={formatCurrency(fireTarget)} />
        <FormulaRow label="毎年の資産成長" formula="資産 × (1 + 利回り)" result="複利計算" />
        <FormulaRow label="安全引出率" formula="年間支出 ÷ 総資産" result={`${((data.annual_spending / Math.max(data.total_assets, 1)) * 100).toFixed(1)}%`} />
      </div>

      <p className="text-[11px] text-gray-400 text-center leading-relaxed px-2">
        ※ 本シミュレーションは参考情報です。実際の運用成果を保証するものではありません。
        <br />投資にはリスクが伴います。詳細はファイナンシャルアドバイザーにご相談ください。
      </p>
    </div>
  );
}

// ─── サブコンポーネント ────────────────────────────────
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
