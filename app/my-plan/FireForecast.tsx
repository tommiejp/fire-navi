import { calculateFireForecast, type ForecastSettings } from "@/lib/fire-forecast";

export default function FireForecast({ settings }: { settings: ForecastSettings | null }) {
  if (!settings) return null;
  const result = calculateFireForecast(settings);
  let message = "現在の条件では100年以内の達成見込みを算出できません";
  if (result.status === "alreadyAchieved") message = "FIRE目標を達成しています";
  if (result.status === "reachable") {
    const years = result.years ? `${result.years}年` : "";
    const months = result.remainingMonths ? `${result.remainingMonths}か月` : "";
    message = `あと ${years}${months}`;
  }
  return <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm" aria-labelledby="fire-forecast-title">
    <h2 id="fire-forecast-title" className="text-lg font-semibold">FIRE達成予測</h2>
    <p className="mt-4 break-words text-xl font-bold">{message}</p>
    <p className="mt-3 text-xs text-gray-600">想定利回りと毎月の積立額が一定の場合のシミュレーションです</p>
    <p className="mt-2 text-xs text-gray-600">積立は毎月末に行う前提です。税金・手数料・インフレ・途中の取り崩しは考慮していません。将来の運用成果を保証するものではありません。</p>
  </section>;
}
