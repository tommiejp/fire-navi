type ProgressSettings = { total_assets: number | string; annual_expenses: number | string };

export function calculateFireProgress(settings: ProgressSettings | null) {
  if (!settings) return null;
  const parse = (value: number | string) => {
    if (typeof value === "string" && !/^\d+$/.test(value)) return NaN;
    return Number(value);
  };
  const assets = parse(settings.total_assets);
  const expenses = parse(settings.annual_expenses);
  if (!Number.isSafeInteger(assets) || assets < 0 || !Number.isSafeInteger(expenses) || expenses <= 0) return null;
  const target = expenses / 0.04;
  const percentage = assets / target * 100;
  const remaining = Math.max(target - assets, 0);
  return { target, percentage, remaining, barPercentage: Math.min(percentage, 100) };
}
