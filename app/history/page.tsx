import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type HistoryRow = { id: string; total_assets: number | string; recorded_at: string };
const dateFormat = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
});

function displayDate(timestamp: string) {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? "日時を表示できません" : dateFormat.format(date);
}

function displayAssets(value: number | string) {
  // Avoid displaying silently rounded BIGINT values returned as unsafe Numbers.
  if (typeof value === "number" && (!Number.isSafeInteger(value) || value < 0)) return "金額を表示できません";
  if (typeof value === "string" && !/^\d+$/.test(value)) return "金額を表示できません";
  return `${BigInt(value).toLocaleString("ja-JP")} 円`;
}

export default async function HistoryPage() {
  let user;
  try {
    user = await getAuthenticatedUser();
  } catch {
    return <main className="mx-auto max-w-2xl px-4 py-10">
      <p role="alert">認証を確認できませんでした。時間をおいて再度お試しください。</p>
      <Link href="/" className="mt-4 inline-block text-indigo-700 underline">FIREナビトップへ戻る</Link>
    </main>;
  }
  if (!user) redirect("/login");

  let history: HistoryRow[] = [];
  let readFailed = false;
  try {
    const supabase = await createClient();
    // Row ownership is enforced by RLS using the current authenticated session.
    const { data, error } = await supabase.from("asset_history")
      .select("id, total_assets, recorded_at")
      .order("recorded_at", { ascending: false });
    if (error || !data) readFailed = true;
    else history = data;
  } catch {
    readFailed = true;
  }

  return <main className="mx-auto max-w-2xl px-4 py-10">
    <nav aria-label="ページ移動" className="flex flex-wrap gap-4 text-sm text-indigo-700 underline underline-offset-4">
      <Link href="/my-plan">マイプランへ戻る</Link>
      <Link href="/account">アカウント</Link>
      <Link href="/">FIREナビトップへ戻る</Link>
    </nav>
    <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm" aria-labelledby="history-title">
      <h1 id="history-title" className="text-2xl font-bold">資産履歴</h1>
      {readFailed ? <p role="alert" className="mt-4 text-sm text-red-700">資産履歴を取得できませんでした。時間をおいて再度お試しください。</p>
        : history.length === 0 ? <p className="mt-4 text-gray-600">まだ資産履歴はありません</p>
        : <>
          <p className="mt-2 text-sm text-gray-600">新しい記録から表示しています。日時は日本時間です。</p>
          <ul className="mt-4 divide-y divide-gray-200">
            {history.map(row => <li key={row.id} className="py-4">
              <dl className="space-y-2">
                <div><dt className="text-sm text-gray-600">記録日時</dt><dd><time dateTime={row.recorded_at}>{displayDate(row.recorded_at)}</time></dd></div>
                <div><dt className="text-sm text-gray-600">総資産</dt><dd className="break-words text-lg font-semibold">{displayAssets(row.total_assets)}</dd></div>
              </dl>
            </li>)}
          </ul>
        </>}
    </section>
  </main>;
}
