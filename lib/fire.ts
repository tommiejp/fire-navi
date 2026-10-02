export interface FireData {
  total_assets: number;
  annual_spending: number;
  return_rate: number;
}

// 円単位の整数。計算・表示が扱える範囲を明示する。
export const MAX_AMOUNT = 1_000_000_000_000;
export const STORAGE_KEY = "fire_navi_v1";
export const DEFAULT_DATA: FireData = {
  total_assets: 5_000_000, annual_spending: 3_000_000, return_rate: 0.05,
};

export function isValidFireData(value: unknown): value is FireData {
  if (typeof value !== "object" || value === null) return false;
  const d = value as Partial<FireData>;
  return typeof d.total_assets === "number" && Number.isSafeInteger(d.total_assets)
    && d.total_assets >= 0 && d.total_assets <= MAX_AMOUNT
    && typeof d.annual_spending === "number" && Number.isSafeInteger(d.annual_spending)
    && d.annual_spending > 0 && d.annual_spending <= MAX_AMOUNT
    && typeof d.return_rate === "number" && Number.isFinite(d.return_rate)
    && d.return_rate >= 0.03 && d.return_rate <= 0.07;
}

export function parseAmount(raw: string, positive: boolean): { value: number | null; error: string | null } {
  if (raw === "") return { value: null, error: "金額を入力してください。" };
  // 部分的な数値変換をしない。指数表記・符号・小数・文字混在は拒否する。
  if (!/^[0-9]+$/.test(raw)) return { value: null, error: "半角数字の整数（円）で入力してください。指数表記は使えません。" };
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value > MAX_AMOUNT)
    return { value: null, error: "金額は1兆円以下で入力してください。" };
  if (positive && value === 0) return { value: null, error: "年間支出は0円より大きい金額を入力してください。" };
  return { value, error: null };
}

export function restoreFireData(raw: string): FireData | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!isValidFireData(value)) return null;
    return { total_assets: value.total_assets, annual_spending: value.annual_spending, return_rate: value.return_rate };
  } catch { return null; }
}

export function calculateFire(data: FireData) {
  if (!isValidFireData(data)) return null;
  const fireTarget = data.annual_spending / 0.04;
  let assets = data.total_assets;
  let yearsToFire: number | null = assets >= fireTarget ? 0 : null;
  const simulation = [{ year: 0, assets, target: fireTarget }];
  if (yearsToFire !== 0) {
    for (let year = 1; year <= 60; year++) {
      assets *= 1 + data.return_rate;
      simulation.push({ year, assets, target: fireTarget });
      if (assets >= fireTarget) { yearsToFire = year; break; }
    }
  }
  return { fireTarget, yearsToFire, simulation };
}
