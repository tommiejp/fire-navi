export type SettingsField = "total_assets" | "annual_expenses" | "monthly_contribution" | "expected_return";

// UI guidance only. The Server Action remains responsible for validation.
export function settingsInputError(name: SettingsField, value: string): string | undefined {
  if (value === "") return "入力してください。";
  if (name === "expected_return") {
    if (!/^\d+(\.\d{1,2})?$/.test(value)) return "半角数字で入力してください（小数は2桁まで）。指数表記は使えません。";
    if (!Number.isFinite(Number(value)) || Number(value) > 20) return "0〜20の範囲で入力してください（5%なら5）。";
  } else {
    if (!/^\d+$/.test(value)) return "半角の整数で入力してください。カンマ・小数・指数表記は使えません。";
    if (!Number.isSafeInteger(Number(value))) return "9,007,199,254,740,991円以下で入力してください。";
    if (name === "annual_expenses" && Number(value) < 1) return "年間支出は1円以上で入力してください。";
  }
}
