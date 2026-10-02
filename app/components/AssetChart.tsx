"use client";

/**
 * AssetChart
 * ─────────────────────────────────────────────────────
 * Recharts を使って「資産推移 vs FIRE目標」の
 * エリアチャートを描画するクライアントコンポーネント。
 *
 * Props:
 *   data          – シミュレーション結果の配列
 *   formatCurrency – 金額フォーマット関数（親から受け取る）
 */

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

// ─── 型定義 ────────────────────────────────────────────
export interface SimulationPoint {
  year: number;   // 経過年数（0 = 現在）
  assets: number; // その年の資産額（円）
  target: number; // FIRE必要資産額（円・固定）
}

interface AssetChartProps {
  data: SimulationPoint[];
  formatCurrency: (amount: number) => string;
}

// ─── カスタムツールチップ ──────────────────────────────
interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: number;
  formatCurrency: (amount: number) => string;
}

function CustomTooltip({
  active,
  payload,
  label,
  formatCurrency,
}: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-3 text-xs">
      <p className="font-bold text-gray-700 mb-2">
        {label === 0 ? "現在" : `${label}年後`}
      </p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 mb-1">
          <span
            className="inline-block w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-gray-500">
            {entry.name === "assets" ? "資産" : "FIRE目標"}:
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
export default function AssetChart({ data, formatCurrency }: AssetChartProps) {
  // FIRE達成年（資産 >= 目標になった最初の年）
  const firePoint = data.find((d) => d.assets >= d.target);
  const fireYear = firePoint?.year;

  // Y軸の最大値：資産とターゲットの最大値を 10% 余裕込みで設定
  const maxValue = Math.max(
    ...data.map((d) => d.assets),
    ...data.map((d) => d.target)
  );

  // Y軸ラベルの単位変換
  const formatYAxis = (value: number): string => {
    if (value >= 100_000_000) {
      return `${(value / 100_000_000).toFixed(0)}億`;
    }
    if (value >= 10_000) {
      return `${Math.round(value / 10_000)}万`;
    }
    return value.toLocaleString();
  };

  return (
    <div style={{ width: "100%", height: 280 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 16, right: 8, left: 0, bottom: 0 }}
        >
          {/* グラデーション定義 */}
          <defs>
            {/* 資産：インディゴ系 */}
            <linearGradient id="gradAssets" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.02} />
            </linearGradient>
            {/* FIRE目標：エメラルド系 */}
            <linearGradient id="gradTarget" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
            </linearGradient>
          </defs>

          {/* グリッド */}
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />

          {/* X軸：経過年数 */}
          <XAxis
            dataKey="year"
            tickFormatter={(v: number) => (v === 0 ? "現在" : `${v}年`)}
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />

          {/* Y軸：資産額 */}
          <YAxis
            tickFormatter={formatYAxis}
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            axisLine={false}
            tickLine={false}
            width={42}
            domain={[0, Math.ceil((maxValue * 1.1) / 10_000_000) * 10_000_000]}
          />

          {/* ツールチップ */}
          <Tooltip
            content={
              <CustomTooltip
                formatCurrency={formatCurrency}
              />
            }
          />

          {/* 凡例 */}
          <Legend
            formatter={(value: string) =>
              value === "assets" ? "資産推移" : "FIRE目標"
            }
            wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
          />

          {/* FIRE達成年の縦線 */}
          {fireYear !== undefined && fireYear > 0 && (
            <ReferenceLine
              x={fireYear}
              stroke="#10b981"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              label={{
                value: `🎯 ${fireYear}年でFIRE`,
                position: "insideTopRight",
                fontSize: 10,
                fill: "#10b981",
                offset: 4,
              }}
            />
          )}

          {/* エリア：FIRE目標（先に描画→資産の下に敷く） */}
          <Area
            type="monotone"
            dataKey="target"
            name="target"
            stroke="#10b981"
            strokeWidth={2}
            strokeDasharray="6 4"
            fill="url(#gradTarget)"
            dot={false}
            activeDot={false}
          />

          {/* エリア：資産推移（上に重ねる） */}
          <Area
            type="monotone"
            dataKey="assets"
            name="assets"
            stroke="#4f46e5"
            strokeWidth={2.5}
            fill="url(#gradAssets)"
            dot={false}
            activeDot={{ r: 5, fill: "#4f46e5", stroke: "#fff", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
