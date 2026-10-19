import { type ForecastSettings } from "@/lib/fire-forecast";
import { calculateFireProjection } from "@/lib/fire-projection";
import ProjectionChart from "./ProjectionChart";

export default function FireProjection({ settings }: { settings: ForecastSettings | null }) {
  const projection = calculateFireProjection(settings);
  if (!projection) return null;
  return <section className="mt-6 min-w-0 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6" aria-labelledby="projection-title">
    <h2 id="projection-title" className="text-lg font-semibold">将来資産推移</h2>
    <p className="mt-2 text-sm text-gray-600">FIRE目標額: {new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 0 }).format(projection.target)} 円</p>
    <ProjectionChart points={projection.points} target={projection.target} />
    <p className="mt-3 text-xs text-gray-600">現在と各年末の予測資産を、達成年の年末まで（最大30年）表示します。達成済みの場合は現在のみ表示します。積立は月末、利回りと積立額は一定と仮定し、税金・手数料・インフレ・取り崩しは考慮していません。</p>
    {projection.truncated && <p className="mt-2 text-xs text-gray-600">数値を安全に扱える範囲の年末まで表示しています。</p>}
  </section>;
}
