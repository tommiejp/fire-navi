export type ForecastSettings = {
  total_assets: number | string;
  annual_expenses: number | string;
  monthly_contribution: number | string;
  expected_return: number | string;
};

export type FireForecast =
  | { status: "alreadyAchieved"; months: 0 }
  | { status: "reachable"; months: number; years: number; remainingMonths: number; projectedAssets: number }
  | { status: "notReachable" };

function parse(value: number | string): number {
  if (typeof value === "number") return value;
  return typeof value === "string" && /^\d+(\.\d+)?$/.test(value) ? Number(value) : NaN;
}

// Amounts are whole yen at input; retain fractional yen during compounding.
export function calculateFireForecast(settings: ForecastSettings | null): FireForecast {
  const unavailable: FireForecast = { status: "notReachable" };
  if (!settings) return unavailable;
  let assets = parse(settings.total_assets);
  const expenses = parse(settings.annual_expenses);
  const contribution = parse(settings.monthly_contribution);
  const annualRate = parse(settings.expected_return);
  if (![assets, expenses, contribution].every(value => Number.isSafeInteger(value) && value >= 0)
    || expenses <= 0 || !Number.isFinite(annualRate) || annualRate < 0 || annualRate > 20) return unavailable;
  const target = expenses / 0.04;
  // Conservatively stop outside the precision range, including derived targets.
  if (!Number.isFinite(target) || target > Number.MAX_SAFE_INTEGER) return unavailable;
  if (assets >= target) return { status: "alreadyAchieved", months: 0 };
  const monthlyRate = annualRate / 100 / 12;
  for (let months = 1; months <= 1200; months++) {
    assets = assets * (1 + monthlyRate) + contribution;
    if (!Number.isFinite(assets) || assets > Number.MAX_SAFE_INTEGER) return unavailable;
    // Allow tiny rounding differences only; never treat a whole-yen shortfall as reached.
    const tolerance = Math.min(0.000001, Number.EPSILON * Math.max(assets, target) * months * 4);
    if (assets >= target || target - assets <= tolerance) {
      return { status: "reachable", months, years: Math.floor(months / 12), remainingMonths: months % 12, projectedAssets: assets };
    }
  }
  return unavailable;
}
