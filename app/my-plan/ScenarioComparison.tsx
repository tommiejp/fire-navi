"use client";

import { useState } from "react";
import type { ForecastSettings } from "@/lib/fire-forecast";
import { compareForecasts, evaluateScenario, forecastText, initialScenario, scenarioNames } from "@/lib/fire-scenarios";

const yen = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 0 });
const fields = [
  ["annual_expenses", "年間支出（円）", "numeric"],
  ["monthly_contribution", "毎月の積立額（円）", "numeric"],
  ["expected_return", "想定利回り（%・0〜20）", "decimal"],
] as const;

export default function ScenarioComparison({ settings }: { settings: ForecastSettings }) {
  const [plans, setPlans] = useState(() => scenarioNames.map(() => initialScenario(settings)));
  const baseline = evaluateScenario(settings.total_assets, initialScenario(settings));
  return <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6" aria-labelledby="scenario-title">
    <h2 id="scenario-title" className="text-lg font-semibold">シナリオ比較</h2>
    <p className="mt-2 text-sm text-gray-600">現在資産は共通です。3プランは同じ条件から開始します。変更内容は保存されません。</p>
    <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
      {scenarioNames.map((name, index) => {
        const inputs = index === 0 ? initialScenario(settings) : plans[index];
        const result = evaluateScenario(settings.total_assets, inputs);
        return <div key={name} className="min-w-0 rounded-xl border border-gray-200 p-3">
          <h3 className="font-semibold">{name}</h3>
          <div className="mt-4 space-y-3">
            {fields.map(([field, label, inputMode]) => <div key={field}>
              <label htmlFor={`scenario-${index}-${field}`} className="text-sm">{label}</label>
              <input id={`scenario-${index}-${field}`} type="text" inputMode={inputMode}
                value={inputs[field]} readOnly={index === 0} aria-invalid={!result}
                onChange={event => {
                  const value = event.target.value;
                  setPlans(previous => previous.map((plan, i) => i === index ? { ...plan, [field]: value } : plan));
                }}
                className="mt-1 w-full min-w-0 rounded-lg border border-gray-300 px-2 py-2 read-only:bg-gray-100" />
            </div>)}
          </div>
          <div className="mt-4 text-sm" aria-live="polite">
            {!result ? <p className="text-red-700">入力内容を確認してください</p> : <dl className="space-y-3 break-words">
              <div><dt className="text-gray-600">FIRE目標額</dt><dd>{yen.format(result.target)} 円</dd></div>
              <div><dt className="text-gray-600">FIRE達成予測</dt><dd>{forecastText(result.forecast)}</dd></div>
              <div><dt className="text-gray-600">30年後の予測資産</dt><dd>{result.assetsAt30 === null ? "算出不能" : yen.format(result.assetsAt30) + " 円"}</dd></div>
              <div><dt className="text-gray-600">現状プランとの差</dt><dd>{compareForecasts(baseline?.forecast, result.forecast)}</dd></div>
            </dl>}
          </div>
        </div>;
      })}
    </div>
    <p className="mt-4 text-xs text-gray-600">利回り・月末積立は一定と仮定し、30年後の資産は目標達成後も運用・積立を続ける場合の概算です。税金・手数料・インフレ・取り崩しは考慮していません。将来の成果を保証するものではありません。</p>
  </section>;
}
