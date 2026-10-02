"use client";

/**
 * TrackingChart
 * ─────────────────────────────────────────────────────
 * 資産トラッキングの時系列グラフ（PRO機能）。
 * 実際に記録した資産を折れ線＋エリアで表示する。
 *
 * Props:
 *   records        – ソート済みの資産記録一覧
 *   fireTarget     – FIRE目標資産（点線で表示）
 *   formatCurrency – 金額フォーマット関数
 */

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
} from "recharts";

// ─── 型定義 ────────────────────────────────────────────
export interface AssetRecord {
  id: string;
  date: string;         // "YYYY-MM-DD"
  total_assets: number; // 円
  note: string;
  recorded_at: string;  // ISO datetime
}

interface TrackingChartProps {
  records: AssetRecord[];
  fireTarget: number;
  formatCurrency: (amount: number) => string;
}

// ─── カスタムツールチップ ──────────────────────────────
interface TooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  formatCurrency: (amount: number) => string;
}

function CustomTooltip({ active, payload, label, formatCurrency }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-3 text-xs">
      <p className="font-bold text-gray-700 mb-2">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-gray-500">{entry.name === "total_assets" ? "資産" : "FIRE目標"}:</span>
          <span className="font-semibold text-gray-900 ml-auto pl-2">{formatCurrency(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── メインコンポーネント ──────────────────────────────
export default function TrackingChart({ records, fireTarget, formatCurrency }: TrackingChartProps) {
  if (records.length === 0) return null;

  // グラフ用データ（日付をラベルに変換）
  const chartData = records.map((r) => {
    const d = new Date(r.date);
    const label = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
    return {
      label,
      total_assets: r.total_assets,
      fire_target: fireTarget,
    };
  });

  // Y軸最大値
  const maxAssets = Math.max(...records.map((r) => r.total_assets), fireTarget);

  const formatYAxis = (v: number): string => {
    if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(0)}億`;
    if (v >= 10_000) return `${Math.round(v / 10_000)}万`;
    return String(v);
  };

  return (
    <div style={{ width: "100%", height: 240 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gradTracking" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />

          <XAxis
            dataKey="label"
            tick={{ fontSize: 9, fill: "#9ca3af" }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />

          <YAxis
            tickFormatter={formatYAxis}
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            axisLine={false}
            tickLine={false}
            width={42}
            domain={[0, Math.ceil((maxAssets * 1.15) / 10_000_000) * 10_000_000]}
          />

          <Tooltip content={<CustomTooltip formatCurrency={formatCurrency} />} />

          <Legend
            formatter={(v: string) => v === "total_assets" ? "記録資産" : "FIRE目標"}
            wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
          />

          {/* FIRE目標ライン */}
          <ReferenceLine
            y={fireTarget}
            stroke="#10b981"
            strokeWidth={1.5}
            strokeDasharray="5 4"
            label={{ value: `目標 ${formatCurrency(fireTarget)}`, position: "insideTopRight", fontSize: 9, fill: "#10b981" }}
          />

          {/* 資産エリア */}
          <Area
            type="monotone"
            dataKey="total_assets"
            name="total_assets"
            stroke="#f59e0b"
            strokeWidth={2.5}
            fill="url(#gradTracking)"
            dot={{ r: 4, fill: "#f59e0b", stroke: "#fff", strokeWidth: 2 }}
            activeDot={{ r: 6, fill: "#f59e0b", stroke: "#fff", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
