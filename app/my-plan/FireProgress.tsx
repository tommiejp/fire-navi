import { calculateFireProgress } from "@/lib/fire-progress";

const yen = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 1 });

export default function FireProgress({ settings }: {
  settings: { total_assets: number | string; annual_expenses: number | string } | null;
}) {
  const progress = calculateFireProgress(settings);
  if (!progress) return null;
  return <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm" aria-labelledby="fire-progress-title">
    <h2 id="fire-progress-title" className="text-lg font-semibold">FIRE進捗</h2>
    <dl className="mt-4 grid gap-4 sm:grid-cols-2">
      <div><dt className="text-sm text-gray-600">FIRE目標額</dt><dd className="mt-1 break-words text-xl font-bold">{yen.format(progress.target)} 円</dd></div>
      <div><dt className="text-sm text-gray-600">FIREまでの残額</dt><dd className="mt-1 break-words text-xl font-bold">{yen.format(progress.remaining)} 円</dd></div>
    </dl>
    <p id="fire-progress-label" className="mt-5 text-sm font-medium">進捗率: {percent.format(progress.percentage)}%</p>
    <progress aria-labelledby="fire-progress-label" max={100} value={progress.barPercentage}
      className="mt-2 block h-4 w-full overflow-hidden rounded-full accent-indigo-600" />
    <p className="mt-3 text-xs text-gray-600">4%ルールに基づく目標資産額への進捗です。FIRE達成や将来の運用成果を保証するものではありません。</p>
  </section>;
}
