"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { scenarioNames, type evaluateScenario } from "@/lib/fire-scenarios";

const colors = ["#4f46e5", "#047857", "#b45309"];
const dashes = ["", "8 3", "2 3"];
const yen = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat("ja-JP", { notation: "compact", maximumFractionDigits: 1 });

export default function ScenarioChart({ results }: { results: ReturnType<typeof evaluateScenario>[] }) {
  const series = results.flatMap((result, index) => result?.projection?.points.length
    ? [{ index, result, projection: result.projection }] : []);
  if (!series.length) return null;
  // Missing/unsafe future values stay null: never extend a truncated series.
  const data = Array.from({ length: 31 }, (_, year) => ({
    year,
    ...Object.fromEntries(series.map(({ index, projection }) => [
      `plan${index}`, projection.points.find(point => point.year === year)?.assets ?? null,
    ])),
  }));
  return <section className="mt-6 min-w-0" aria-labelledby="scenario-chart-title">
    <h3 id="scenario-chart-title" className="font-semibold">3プランの将来資産推移</h3>
    <ul className="mt-3 space-y-2 text-sm">
      {series.map(({ index, result, projection }) => <li key={index} className="break-words">
        <span style={{ color: colors[index] }}>● {scenarioNames[index]}</span>
        {" — FIRE目標額: "}{yen.format(result.target)} 円
        {projection.truncated && "（安全に表示できる年まで）"}
      </li>)}
    </ul>
    <div className="mt-4 h-64 w-full min-w-0 sm:h-80">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <LineChart data={data} margin={{ top: 12, right: 12, bottom: 8, left: 0 }} accessibilityLayer>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="year" type="number" domain={[0, 30]} allowDecimals={false}
            tickFormatter={value => Number(value) === 0 ? "現在" : `${value}年`} minTickGap={24} tick={{ fontSize: 11 }} />
          <YAxis width={68} domain={[0, "auto"]} tick={{ fontSize: 11 }} tickFormatter={value => compact.format(Number(value)) + "円"} />
          <Tooltip labelFormatter={value => Number(value) === 0 ? "現在" : `${value}年後`}
            formatter={(value, name) => [yen.format(Number(value)) + " 円", name]} />
          {series.map(({ index }) => <Line key={index} type="linear" dataKey={`plan${index}`} name={scenarioNames[index]}
            stroke={colors[index]} strokeDasharray={dashes[index]} strokeWidth={2} dot={{ r: 2 }}
            activeDot={{ r: 5 }} connectNulls={false} isAnimationActive={false} />)}
        </LineChart>
      </ResponsiveContainer>
    </div>
    <p className="mt-2 text-xs text-gray-600">各年末の予測資産を表示します。同条件の線は重なります。不正な入力のプランは表示しません。</p>
  </section>;
}
