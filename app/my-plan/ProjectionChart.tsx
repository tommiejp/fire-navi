"use client";

import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ProjectionPoint } from "@/lib/fire-projection";

const yen = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 0 });
const compactYen = new Intl.NumberFormat("ja-JP", { notation: "compact", maximumFractionDigits: 1 });

export default function ProjectionChart({ points, target }: { points: ProjectionPoint[]; target: number }) {
  if (!points.length) return null;
  return <div className="mt-4 h-64 w-full min-w-0 sm:h-72">
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <LineChart data={points} margin={{ top: 16, right: 12, bottom: 8, left: 0 }} accessibilityLayer>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="year" type="number" domain={points.length === 1 ? [-1, 1] : [0, points[points.length - 1].year]}
          ticks={points.length === 1 ? [0] : undefined} allowDecimals={false}
          tickFormatter={value => Number(value) === 0 ? "現在" : `${value}年`} minTickGap={24} tick={{ fontSize: 11 }} />
        <YAxis width={68} domain={[0, "auto"]} tick={{ fontSize: 11 }}
          tickFormatter={value => compactYen.format(Number(value)) + "円"} />
        <Tooltip labelFormatter={value => Number(value) === 0 ? "現在" : `${value}年後（年末）`}
          formatter={value => [yen.format(Number(value)) + " 円", "予測資産"]} />
        <ReferenceLine y={target} stroke="#d97706" strokeDasharray="5 5" ifOverflow="extendDomain" label={{ value: "FIRE目標", position: "insideTopRight", fontSize: 11 }} />
        <Line type="linear" dataKey="assets" name="予測資産" stroke="#4f46e5" strokeWidth={2}
          dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  </div>;
}
