import { calculateFireForecast, nextMonthlyAssets, prepareFireSettings, type ForecastSettings } from "./fire-forecast";

export type ProjectionPoint = { year: number; assets: number };
export type FireProjection = { target: number; points: ProjectionPoint[]; truncated: boolean };

export function calculateFireProjection(settings: ForecastSettings | null, options: { stopAtAchievement?: boolean } = {}): FireProjection | null {
  const input = prepareFireSettings(settings);
  if (!input) return null;
  const forecast = calculateFireForecast(settings);
  const years = options.stopAtAchievement === false ? 30 : forecast.status === "alreadyAchieved" ? 0
    : forecast.status === "reachable" ? Math.min(30, Math.ceil(forecast.months / 12)) : 30;
  let assets = input.assets;
  const points: ProjectionPoint[] = [{ year: 0, assets }];
  for (let month = 1; month <= years * 12; month++) {
    assets = nextMonthlyAssets(assets, input.monthlyRate, input.contribution);
    if (!Number.isFinite(assets) || assets > Number.MAX_SAFE_INTEGER) {
      return { target: input.target, points, truncated: true };
    }
    if (month % 12 === 0) points.push({ year: month / 12, assets });
  }
  return { target: input.target, points, truncated: false };
}
