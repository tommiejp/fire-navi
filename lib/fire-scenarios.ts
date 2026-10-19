import { calculateFireForecast, type ForecastSettings, type FireForecast } from "./fire-forecast";
import { calculateFireProjection } from "./fire-projection";

export const scenarioNames = ["現状プラン", "積極積立プラン", "節約プラン"] as const;
export type ScenarioInputs = { annual_expenses: string; monthly_contribution: string; expected_return: string };

export function initialScenario(settings: ForecastSettings): ScenarioInputs {
  return { annual_expenses: String(settings.annual_expenses), monthly_contribution: String(settings.monthly_contribution), expected_return: String(settings.expected_return) };
}

export function evaluateScenario(totalAssets: number | string, inputs: ScenarioInputs) {
  const amount = (value: string, min: number) => /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) >= min;
  if (!amount(inputs.annual_expenses, 1) || !amount(inputs.monthly_contribution, 0)
    || !/^\d+(\.\d+)?$/.test(inputs.expected_return) || !Number.isFinite(Number(inputs.expected_return))
    || Number(inputs.expected_return) < 0 || Number(inputs.expected_return) > 20) return null;
  const target = Number(inputs.annual_expenses) / 0.04;
  if (!Number.isFinite(target) || target > Number.MAX_SAFE_INTEGER) return null;
  const settings = { total_assets: totalAssets, ...inputs };
  const forecast = calculateFireForecast(settings);
  const projection = calculateFireProjection(settings, { stopAtAchievement: false });
  return {
    target,
    forecast,
    assetsAt30: projection?.points.find(point => point.year === 30)?.assets ?? null,
  };
}

export function duration(months: number): string {
  const years = Math.floor(months / 12), remainder = months % 12;
  return (years ? `${years}年` : "") + (remainder || !years ? `${remainder}か月` : "");
}

export function forecastText(forecast: FireForecast): string {
  return forecast.status === "alreadyAchieved" ? "達成済み"
    : forecast.status === "reachable" ? `あと${duration(forecast.months)}` : "算出不能（100年以内）";
}

export function compareForecasts(current: FireForecast | undefined, scenario: FireForecast): string {
  if (!current || current.status === "notReachable" || scenario.status === "notReachable") return "比較不能";
  const difference = scenario.months - current.months;
  return difference === 0 ? "現状プランと同じ" : `${duration(Math.abs(difference))}${difference < 0 ? "早い" : "遅い"}`;
}
