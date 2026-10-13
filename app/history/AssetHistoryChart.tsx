"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatAssetYen, type AssetPoint } from "@/lib/asset-history-chart";

const day = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "2-digit", month: "2-digit", day: "2-digit" });
const dateTime = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

export default function AssetHistoryChart({ points }: { points: AssetPoint[] }) {
  if (points.length === 0) return null;
  const first = points[0].timestamp;
  const last = points[points.length - 1].timestamp;
  // Center a single timestamp, including several records at the same instant.
  const domain = first === last ? [first - 43200000, last + 43200000] : [first, last];
  return <section className="mt-5 min-w-0" aria-labelledby="asset-chart-title">
    <h2 id="asset-chart-title" className="text-lg font-semibold">資産推移</h2>
    <p className="mt-1 text-xs text-gray-600">取得済み履歴のうち、表示可能な最新50件までを古い順に表示。日時は日本時間、金額は円です。詳細は下の一覧でも確認できます。</p>
    <div className="mt-3 h-64 w-full min-w-0 sm:h-72">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <LineChart data={points} margin={{ top: 12, right: 12, bottom: 8, left: 0 }} accessibilityLayer>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="timestamp" type="number" scale="time" domain={domain}
            tickFormatter={value => day.format(Number(value))} minTickGap={35} tick={{ fontSize: 11 }} />
          <YAxis width={64} domain={[0, "auto"]} tick={{ fontSize: 11 }}
            tickFormatter={value => new Intl.NumberFormat("ja-JP", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value)) + "円"} />
          <Tooltip labelFormatter={value => dateTime.format(Number(value))}
            formatter={value => [formatAssetYen(Number(value)), "総資産"]} />
          <Line type="linear" dataKey="assets" name="総資産" stroke="#4f46e5" strokeWidth={2}
            dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  </section>;
}
