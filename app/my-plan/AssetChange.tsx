import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { calculateAssetChange } from "@/lib/asset-change";

const money = new Intl.NumberFormat("ja-JP", { signDisplay: "exceptZero", maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat("ja-JP", { signDisplay: "exceptZero", maximumFractionDigits: 1 });

// Rendered only after /my-plan has verified the user. RLS filters history rows.
export default async function AssetChange() {
  let rows: { total_assets: number | string }[] = [];
  let failed = false;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("asset_history").select("total_assets")
      .order("recorded_at", { ascending: false }).order("id", { ascending: false }).limit(2);
    if (error || !data) failed = true;
    else rows = data;
  } catch {
    failed = true;
  }
  const change = calculateAssetChange(rows);
  return <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm" aria-labelledby="asset-change-title">
    <h2 id="asset-change-title" className="text-lg font-semibold">前回記録比</h2>
    {failed ? <p role="alert" className="mt-3 text-sm text-red-700">前回比を取得できませんでした。時間をおいて再度お試しください。</p>
      : rows.length < 2 ? <p className="mt-3 text-sm text-gray-600">資産履歴を2件以上記録すると前回比を表示します。</p>
      : !change ? <p className="mt-3 text-sm text-gray-600">前回比を計算できません。</p>
      : <>
        <p className="mt-2 text-xs text-gray-600">最新の記録と、その1つ前の記録を比較しています。</p>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div><dt className="text-sm text-gray-600">増減額</dt><dd className="mt-1 break-words text-xl font-semibold">{money.format(change.amount)} 円</dd></div>
          <div><dt className="text-sm text-gray-600">増減率</dt><dd className="mt-1 break-words text-xl font-semibold">{change.percentage === null ? "算出不可（前回0円）" : `${percent.format(change.percentage)}%`}</dd></div>
        </dl>
      </>}
    <Link href="/history" className="mt-4 inline-block text-sm font-medium text-indigo-700 underline underline-offset-4">資産推移を見る</Link>
  </section>;
}
