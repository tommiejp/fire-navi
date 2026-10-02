"use client";

/**
 * ScenarioSimulator（PRO機能）
 * ─────────────────────────────────────────────────────
 * 拡張シミュレーション機能。
 *
 * 機能：
 *   ① インフレ率スライダー → 実質利回りを計算
 *   ② 景気シナリオ比較（悲観 / 標準 / 楽観）を同一グラフに表示
 *   ③ カスタムシナリオ比較（最大3パターン、localStorage保存）
 */

import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "./FireCalculator";

// ─── 定数 ──────────────────────────────────────────────
const FIRE_DATA_KEY = "fire_navi_v1";
const SCENARIOS_KEY = "fire_navi_scenarios_v1";
const SCENARIO_COLORS = ["#6366f1", "#f59e0b", "#10b981"] as const;

// ─── 型定義 ────────────────────────────────────────────
interface SimPoint {
  year: number;
  assets: number;
}

interface CustomScenario {
  id: string;
  name: string;
  returnRate: number;
  inflationRate: number;
  color: string;
}

// ─── 景気シナリオのプリセット定義 ──────────────────────
const ECON_PRESETS = {
  pessimistic: {
    label: "悲観",
    emoji: "📉",
    desc: "低成長・高インフレ",
    nominalDelta: -0.02,  // 名目利回りの増減
    inflationDelta: +0.01, // インフレ率の増減
    color: "#ef4444",
    bgClass: "bg-red-50 border-red-100",
    textClass: "text-red-600",
  },
  standard: {
    label: "標準",
    emoji: "📊",
    desc: "平均的なシナリオ",
    nominalDelta: 0,
    inflationDelta: 0,
    color: "#3b82f6",
    bgClass: "bg-blue-50 border-blue-100",
    textClass: "text-blue-600",
  },
  optimistic: {
    label: "楽観",
    emoji: "📈",
    desc: "高成長・低インフレ",
    nominalDelta: +0.02,
    inflationDelta: -0.01,
    color: "#22c55e",
    bgClass: "bg-green-50 border-green-100",
    textClass: "text-green-600",
  },
} as const;

// ─── 計算ロジック ──────────────────────────────────────

/** 実質利回りで資産シミュレーション（FIRE達成で打ち切り） */
function simulate(
  initialAssets: number,
  annualSpending: number,
  nominalReturn: number,
  inflation: number,
  maxYears = 60
): SimPoint[] {
  const fireTarget = Math.round(annualSpending / 0.04);
  const realReturn = nominalReturn - inflation;
  const points: SimPoint[] = [{ year: 0, assets: initialAssets }];
  let assets = initialAssets;

  if (assets >= fireTarget) return points;

  for (let year = 1; year <= maxYears; year++) {
    assets = Math.round(assets * (1 + realReturn));
    points.push({ year, assets });
    if (assets >= fireTarget) break;
  }
  return points;
}

/** FIRE達成年を返す（未達成はnull） */
function findFireYear(points: SimPoint[], target: number): number | null {
  const hit = points.find((p) => p.assets >= target);
  return hit !== undefined ? hit.year : null;
}

/**
 * 複数シナリオをRecharts用にマージ
 * 各シナリオのkeyを列名にしてyear軸で合流させる
 */
function mergeForChart(
  scenarios: Array<{ key: string; points: SimPoint[] }>,
  target: number
): Array<Record<string, number>> {
  if (scenarios.length === 0) return [];
  const maxYear = Math.max(...scenarios.flatMap((s) => s.points.map((p) => p.year)));
  const result: Array<Record<string, number>> = [];

  for (let year = 0; year <= maxYear; year++) {
    const row: Record<string, number> = { year, target };
    for (const s of scenarios) {
      const match = s.points.find((p) => p.year === year);
      if (match) row[s.key] = match.assets;
    }
    result.push(row);
  }
  return result;
}

/** Y軸ラベルの単位変換 */
function formatY(value: number): string {
  if (value >= 100_000_000) return `${(value / 100_000_000).toFixed(0)}億`;
  if (value >= 10_000) return `${Math.round(value / 10_000)}万`;
  return String(value);
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ─── カスタムツールチップ ──────────────────────────────
interface TooltipEntry {
  name: string;
  value: number;
  color: string;
}
interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: number;
  nameMap?: Record<string, string>;
}

function ChartTooltip({ active, payload, label, nameMap }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const filtered = payload.filter((p) => p.name !== "target");
  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-3 text-xs">
      <p className="font-bold text-gray-700 mb-2">
        {label === 0 ? "現在" : `${label}年後`}
      </p>
      {filtered.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 mb-1 last:mb-0">
          <span
            className="inline-block w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-gray-500">
            {nameMap?.[entry.name] ?? entry.name}:
          </span>
          <span className="font-semibold text-gray-900 ml-auto pl-2">
            {formatCurrency(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── メインコンポーネント ──────────────────────────────
export default function ScenarioSimulator() {
  // ── 基本パラメータ（FireCalculatorのlocalStorageから初期値取得）
  const [totalAssets, setTotalAssets] = useState(5_000_000);
  const [annualSpending, setAnnualSpending] = useState(3_000_000);
  const [returnRate, setReturnRate] = useState(0.05);
  const [inflationRate, setInflationRate] = useState(0.02);

  // ── カスタムシナリオ
  const [customScenarios, setCustomScenarios] = useState<CustomScenario[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("マイシナリオ");
  const [newReturn, setNewReturn] = useState(0.05);
  const [newInflation, setNewInflation] = useState(0.02);

  const [isHydrated, setIsHydrated] = useState(false);

  // ── localStorage 復元
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FIRE_DATA_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (typeof p.total_assets === "number") setTotalAssets(p.total_assets);
        if (typeof p.annual_spending === "number") setAnnualSpending(p.annual_spending);
        if (typeof p.return_rate === "number") setReturnRate(p.return_rate);
      }
    } catch { /* ignore */ }

    try {
      const raw = localStorage.getItem(SCENARIOS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setCustomScenarios(parsed);
      }
    } catch { /* ignore */ }

    setIsHydrated(true);
  }, []);

  // ── カスタムシナリオ自動保存
  useEffect(() => {
    if (!isHydrated) return;
    try { localStorage.setItem(SCENARIOS_KEY, JSON.stringify(customScenarios)); } catch { /* ignore */ }
  }, [customScenarios, isHydrated]);

  // ── 計算
  const fireTarget = Math.round(annualSpending / 0.04);
  const realReturn = returnRate - inflationRate;

  // 景気シナリオシミュレーション
  const econSims = (
    Object.entries(ECON_PRESETS) as Array<[string, typeof ECON_PRESETS[keyof typeof ECON_PRESETS]]>
  ).map(([key, preset]) => {
    const nom = Math.max(0, returnRate + preset.nominalDelta);
    const inf = Math.max(0, inflationRate + preset.inflationDelta);
    const points = simulate(totalAssets, annualSpending, nom, inf);
    return {
      key,
      label: preset.label,
      emoji: preset.emoji,
      desc: preset.desc,
      color: preset.color,
      bgClass: preset.bgClass,
      textClass: preset.textClass,
      nominalReturn: nom,
      inflation: inf,
      realReturn: nom - inf,
      points,
      fireYear: findFireYear(points, fireTarget),
    };
  });

  const econChartData = mergeForChart(
    econSims.map((s) => ({ key: s.key, points: s.points })),
    fireTarget
  );
  const econNameMap = Object.fromEntries(econSims.map((s) => [s.key, s.label]));

  // カスタムシナリオシミュレーション
  const customSims = customScenarios.map((s) => {
    const points = simulate(totalAssets, annualSpending, s.returnRate, s.inflationRate);
    return { ...s, points, fireYear: findFireYear(points, fireTarget) };
  });

  const customChartData = mergeForChart(
    customSims.map((s) => ({ key: s.id, points: s.points })),
    fireTarget
  );
  const customNameMap = Object.fromEntries(customSims.map((s) => [s.id, s.name]));

  const addCustomScenario = () => {
    if (!newName.trim() || customScenarios.length >= 3) return;
    setCustomScenarios((prev) => [
      ...prev,
      {
        id: generateId(),
        name: newName.trim(),
        returnRate: newReturn,
        inflationRate: newInflation,
        color: SCENARIO_COLORS[prev.length],
      },
    ]);
    setNewName("マイシナリオ");
    setNewReturn(0.05);
    setNewInflation(0.02);
    setIsAdding(false);
  };

  const removeCustomScenario = (id: string) => {
    setCustomScenarios((prev) => {
      const filtered = prev.filter((s) => s.id !== id);
      // 削除後は色インデックスを詰め直す
      return filtered.map((s, i) => ({ ...s, color: SCENARIO_COLORS[i] }));
    });
  };

  if (!isHydrated) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-400 text-sm animate-pulse">読み込み中…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* ════════════════════════════════════
          ① PRO ヒーローカード
          ════════════════════════════════════ */}
      <div className="rounded-2xl p-5 bg-gradient-to-br from-violet-600 to-purple-500 text-white shadow-md">
        <div className="flex items-center gap-2 mb-3">
          <span className="bg-white/20 text-white text-[10px] font-black px-2.5 py-1 rounded-full tracking-widest uppercase">
            ✦ PRO機能
          </span>
          <span className="text-purple-200 text-xs">拡張シミュレーション</span>
        </div>
        <p className="text-2xl font-black tracking-tight leading-snug mb-1">
          インフレ × 景気シナリオで<br />リアルな将来を把握
        </p>
        <p className="text-purple-200 text-xs leading-relaxed mt-2">
          名目利回りからインフレを差し引いた実質利回りで計算。楽観・標準・悲観の3シナリオとカスタム比較で将来を多角的に分析できます。
        </p>

        {/* 実質利回りサマリー */}
        <div className="mt-4 bg-white/15 rounded-xl px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-purple-200 text-xs">現在の実質利回り</p>
            <p className="text-purple-300 text-[11px] mt-0.5">
              名目 {(returnRate * 100).toFixed(1)}% − インフレ {(inflationRate * 100).toFixed(1)}%
            </p>
          </div>
          <span
            className={`text-3xl font-black ${realReturn >= 0 ? "text-white" : "text-red-300"}`}
          >
            {(realReturn * 100).toFixed(1)}%
          </span>
        </div>
      </div>

      {/* ════════════════════════════════════
          ② 基本パラメータ設定
          ════════════════════════════════════ */}
      <div className="bg-white rounded-2xl p-5 shadow-sm space-y-5">
        <h2 className="text-sm font-bold text-gray-800">⚙️ シミュレーション設定</h2>

        {/* 資産・支出（2カラム） */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">総資産</label>
            <input
              type="number"
              value={totalAssets}
              onChange={(e) => setTotalAssets(Math.max(0, parseInt(e.target.value) || 0))}
              inputMode="numeric"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 text-right bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
            <p className="text-[10px] text-violet-500 mt-0.5 text-right font-medium">
              {formatCurrency(totalAssets)}
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">年間支出</label>
            <input
              type="number"
              value={annualSpending}
              onChange={(e) => setAnnualSpending(Math.max(1, parseInt(e.target.value) || 1))}
              inputMode="numeric"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 text-right bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
            <p className="text-[10px] text-violet-500 mt-0.5 text-right font-medium">
              {formatCurrency(annualSpending)}
            </p>
          </div>
        </div>

        {/* 名目利回りスライダー */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-medium text-gray-700">名目利回り</label>
            <span className="text-xl font-black text-violet-600">
              {(returnRate * 100).toFixed(1)}%
            </span>
          </div>
          <input
            type="range" min={0.01} max={0.10} step={0.001} value={returnRate}
            onChange={(e) => setReturnRate(parseFloat(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-[10px] text-gray-400 mt-1">
            <span>1%</span><span>5%</span><span>10%</span>
          </div>
        </div>

        {/* インフレ率スライダー */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-medium text-gray-700">インフレ率</label>
            <span className="text-xl font-black text-orange-500">
              {(inflationRate * 100).toFixed(1)}%
            </span>
          </div>
          <input
            type="range" min={0} max={0.05} step={0.001} value={inflationRate}
            onChange={(e) => setInflationRate(parseFloat(e.target.value))}
            className="w-full accent-orange-500"
          />
          <div className="flex justify-between text-[10px] text-gray-400 mt-1">
            <span>0%</span><span>2.5%</span><span>5%</span>
          </div>
        </div>

        {/* 実質利回り表示 */}
        <div
          className={`rounded-xl p-3 flex items-center justify-between border ${
            realReturn >= 0
              ? "bg-violet-50 border-violet-100"
              : "bg-red-50 border-red-100"
          }`}
        >
          <div>
            <p className="text-xs font-semibold text-gray-700">実質利回り（インフレ調整後）</p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {(returnRate * 100).toFixed(1)}% − {(inflationRate * 100).toFixed(1)}%
            </p>
          </div>
          <span
            className={`text-2xl font-black ${realReturn >= 0 ? "text-violet-600" : "text-red-500"}`}
          >
            {(realReturn * 100).toFixed(1)}%
          </span>
        </div>
      </div>

      {/* ════════════════════════════════════
          ③ 景気シナリオ比較
          ════════════════════════════════════ */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-sm font-bold text-gray-800">🌐 景気シナリオ比較</h2>
          <span className="bg-violet-100 text-violet-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
            PRO
          </span>
        </div>
        <p className="text-[11px] text-gray-400 mb-4">
          経済状況ごとのFIRE達成年数を一括比較（利回り±2%・インフレ±1%で調整）
        </p>

        {/* シナリオカード 3列 */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          {econSims.map((s) => (
            <div key={s.key} className={`rounded-xl p-3 border ${s.bgClass}`}>
              <div className="flex items-center gap-1 mb-1.5">
                <span className="text-base leading-none">{s.emoji}</span>
                <span className={`text-[11px] font-bold ${s.textClass}`}>{s.label}</span>
              </div>
              <p className={`text-sm font-black ${s.textClass}`}>
                {s.fireYear === null
                  ? "60年超"
                  : s.fireYear === 0
                  ? "達成済"
                  : `${s.fireYear}年`}
              </p>
              <p className={`text-[10px] mt-0.5 opacity-70 ${s.textClass}`}>
                実質 {(s.realReturn * 100).toFixed(1)}%
              </p>
            </div>
          ))}
        </div>

        {/* 景気シナリオグラフ */}
        <div style={{ width: "100%", height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={econChartData}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis
                dataKey="year"
                tickFormatter={(v: number) => (v === 0 ? "現在" : `${v}年`)}
                tick={{ fontSize: 9, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={formatY}
                tick={{ fontSize: 9, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip
                content={<ChartTooltip nameMap={econNameMap} />}
              />
              <Legend
                formatter={(v: string) => econNameMap[v] ?? v}
                wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
              />
              {/* FIRE目標ライン */}
              <ReferenceLine
                y={fireTarget}
                stroke="#10b981"
                strokeDasharray="5 4"
                strokeWidth={1.5}
                label={{
                  value: "FIRE目標",
                  position: "insideTopRight",
                  fontSize: 9,
                  fill: "#10b981",
                }}
              />
              {/* 3シナリオのライン */}
              {econSims.map((s) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.key}
                  stroke={s.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* シナリオ比較テーブル */}
        <div className="mt-4 rounded-xl overflow-hidden border border-gray-100">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-3 py-2 text-gray-500 font-medium">シナリオ</th>
                <th className="text-right px-3 py-2 text-gray-500 font-medium">実質利回り</th>
                <th className="text-right px-3 py-2 text-gray-500 font-medium">FIRE年数</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {econSims.map((s) => (
                <tr key={s.key}>
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: s.color }}
                      />
                      <span className={`font-semibold ${s.textClass}`}>{s.label}</span>
                      <span className="text-gray-400 text-[10px]">{s.desc}</span>
                    </span>
                  </td>
                  <td className={`text-right px-3 py-2.5 font-semibold ${s.textClass}`}>
                    {(s.realReturn * 100).toFixed(1)}%
                  </td>
                  <td className={`text-right px-3 py-2.5 font-black text-sm ${s.textClass}`}>
                    {s.fireYear === null
                      ? "60年超"
                      : s.fireYear === 0
                      ? "達成済"
                      : `${s.fireYear}年`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ════════════════════════════════════
          ④ カスタムシナリオ比較（最大3パターン）
          ════════════════════════════════════ */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-gray-800">🔮 カスタムシナリオ</h2>
            <span className="bg-violet-100 text-violet-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
              最大3パターン
            </span>
          </div>
          {customScenarios.length < 3 && !isAdding && (
            <button
              onClick={() => setIsAdding(true)}
              className="flex items-center gap-1 text-xs text-violet-600 bg-violet-50 hover:bg-violet-100 active:bg-violet-200 rounded-xl px-3 py-1.5 font-semibold transition-colors"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                <path d="M8 2a.75.75 0 01.75.75v4.5h4.5a.75.75 0 010 1.5h-4.5v4.5a.75.75 0 01-1.5 0v-4.5h-4.5a.75.75 0 010-1.5h4.5v-4.5A.75.75 0 018 2z" />
              </svg>
              追加
            </button>
          )}
        </div>
        <p className="text-[11px] text-gray-400 mb-4">
          独自のパラメータでFIRE年数を自由に比較
        </p>

        {/* 追加フォーム */}
        {isAdding && (
          <div className="mb-4 p-4 bg-violet-50 rounded-xl border border-violet-100">
            <p className="text-xs font-bold text-violet-700 mb-3">新しいシナリオを追加</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-600 mb-1 block">シナリオ名</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  maxLength={20}
                  placeholder="例：積極投資"
                  className="w-full border border-violet-200 rounded-xl px-3 py-2.5 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
              </div>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between mb-1.5">
                    <label className="text-xs text-gray-600">名目利回り</label>
                    <span className="text-xs font-bold text-violet-600">
                      {(newReturn * 100).toFixed(1)}%
                    </span>
                  </div>
                  <input
                    type="range" min={0.01} max={0.12} step={0.001} value={newReturn}
                    onChange={(e) => setNewReturn(parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div>
                  <div className="flex justify-between mb-1.5">
                    <label className="text-xs text-gray-600">インフレ率</label>
                    <span className="text-xs font-bold text-orange-500">
                      {(newInflation * 100).toFixed(1)}%
                    </span>
                  </div>
                  <input
                    type="range" min={0} max={0.08} step={0.001} value={newInflation}
                    onChange={(e) => setNewInflation(parseFloat(e.target.value))}
                    className="w-full accent-orange-400"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between px-3 py-2 bg-white rounded-xl border border-violet-100">
                <span className="text-xs text-gray-500">実質利回り</span>
                <span
                  className={`text-sm font-black ${
                    newReturn - newInflation >= 0 ? "text-violet-600" : "text-red-500"
                  }`}
                >
                  {((newReturn - newInflation) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex gap-2 mt-1">
                <button
                  onClick={() => setIsAdding(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm text-gray-500 bg-gray-100 hover:bg-gray-200 font-medium transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={addCustomScenario}
                  disabled={!newName.trim()}
                  className="flex-1 py-2.5 rounded-xl text-sm text-white bg-violet-600 hover:bg-violet-700 font-bold transition-colors disabled:opacity-40"
                >
                  追加する
                </button>
              </div>
            </div>
          </div>
        )}

        {/* シナリオ一覧 */}
        {customSims.length === 0 && !isAdding ? (
          <div className="text-center py-8">
            <p className="text-4xl mb-2">🔮</p>
            <p className="text-sm font-medium text-gray-500">シナリオをまだ追加していません</p>
            <p className="text-xs text-gray-400 mt-1">「追加」ボタンから独自シナリオを作成できます</p>
          </div>
        ) : (
          <>
            {customSims.length > 0 && (
              <div className="space-y-2 mb-4">
                {customSims.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50/50"
                  >
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: s.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800 truncate">{s.name}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        名目 {(s.returnRate * 100).toFixed(1)}% ／ インフレ {(s.inflationRate * 100).toFixed(1)}% ／ 実質{" "}
                        <strong>{((s.returnRate - s.inflationRate) * 100).toFixed(1)}%</strong>
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0 mr-1">
                      <p
                        className="text-base font-black"
                        style={{ color: s.color }}
                      >
                        {s.fireYear === null
                          ? "60年超"
                          : s.fireYear === 0
                          ? "達成済"
                          : `${s.fireYear}年`}
                      </p>
                    </div>
                    <button
                      onClick={() => removeCustomScenario(s.id)}
                      className="text-gray-300 hover:text-red-400 transition-colors p-1 flex-shrink-0"
                      title="削除"
                    >
                      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* 2件以上でグラフ表示 */}
            {customSims.length >= 2 && (
              <div style={{ width: "100%", height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={customChartData}
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                    <XAxis
                      dataKey="year"
                      tickFormatter={(v: number) => (v === 0 ? "現在" : `${v}年`)}
                      tick={{ fontSize: 9, fill: "#9ca3af" }}
                      axisLine={false}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tickFormatter={formatY}
                      tick={{ fontSize: 9, fill: "#9ca3af" }}
                      axisLine={false}
                      tickLine={false}
                      width={40}
                    />
                    <Tooltip content={<ChartTooltip nameMap={customNameMap} />} />
                    <Legend
                      formatter={(v: string) => customNameMap[v] ?? v}
                      wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                    />
                    <ReferenceLine
                      y={fireTarget}
                      stroke="#10b981"
                      strokeDasharray="5 4"
                      strokeWidth={1.5}
                      label={{
                        value: "FIRE目標",
                        position: "insideTopRight",
                        fontSize: 9,
                        fill: "#10b981",
                      }}
                    />
                    {customSims.map((s) => (
                      <Line
                        key={s.id}
                        type="monotone"
                        dataKey={s.id}
                        name={s.id}
                        stroke={s.color}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, strokeWidth: 0 }}
                        connectNulls={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* 1件のとき案内 */}
            {customSims.length === 1 && (
              <div className="bg-violet-50 rounded-xl p-3 text-center mt-2">
                <p className="text-xs text-violet-600">
                  あと{" "}
                  <strong>{2 - customSims.length}</strong>
                  {" "}件追加するとグラフで比較できます
                </p>
              </div>
            )}
          </>
        )}
      </div>

      <p className="text-[11px] text-gray-400 text-center leading-relaxed px-2">
        ※ インフレ調整後の実質利回りでシミュレーションしています。<br />
        実際の運用成果を保証するものではありません。
      </p>
    </div>
  );
}
