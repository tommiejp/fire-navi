import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";

import ScenarioComparison from "./ScenarioComparison";
import AssetChange from "./AssetChange";
import FireForecast from "./FireForecast";
import FireProjection from "./FireProjection";
import FireProgress from "./FireProgress";
import SettingsForm from "./SettingsForm";
import AssetHistoryForm from "./AssetHistoryForm";

export const dynamic = "force-dynamic";

type FinancialSettings = {
  total_assets: number | string;
  monthly_contribution: number | string;
  annual_expenses: number | string;
  expected_return: number | string;
  updated_at: string;
};

export default async function MyPlanPage() {
  let user;
  try {
    user = await getAuthenticatedUser();
  } catch {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <p role="alert">認証を確認できませんでした。時間をおいて再度お試しください。</p>
        <Link href="/" className="mt-4 inline-block text-indigo-700 underline">FIREナビトップへ戻る</Link>
      </main>
    );
  }
  if (!user) redirect("/login");

  let settings: FinancialSettings | null = null;
  let readFailed = false;
  try {
    const supabase = await createClient();
    // The current user's session and RLS determine row visibility.
    // Do not accept an owner ID from page props, query parameters or the client.
    const { data, error } = await supabase
      .from("user_financial_settings")
      .select("total_assets, annual_expenses, expected_return, monthly_contribution, updated_at")
      .maybeSingle();
    if (error) readFailed = true;
    else settings = data ? { ...data, monthly_contribution: data.monthly_contribution ?? 0 } : null;
  } catch {
    readFailed = true;
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/" className="text-sm font-medium text-indigo-700 underline underline-offset-4">← FIREナビトップへ戻る</Link>
      <Link href="/account" className="ml-4 text-sm text-indigo-700 underline">アカウント</Link>
      <header className="mt-6" aria-labelledby="plan-title">
        <h1 id="plan-title" className="text-2xl font-bold text-gray-900">マイプラン</h1>
        <p className="mt-3 text-sm text-gray-600">ログイン済み</p>
        <p className="mt-1 break-all text-gray-900">{user.email ?? "メールアドレス未登録"}</p>
      </header>
      <nav aria-label="マイプラン内の移動" className="mt-6 flex flex-wrap gap-2">
        {[
          ["current-position", "現在地"],
          ["fire-settings", "設定"],
          ...(!readFailed && settings ? [["future", "将来予測"], ["scenario-comparison", "シナリオ比較"]] : []),
          ["asset-records", "資産記録"],
        ].map(([id, label]) => <a key={id} href={`#${id}`}
          className="inline-flex min-h-11 items-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">{label}</a>)}
      </nav>
      <section id="current-position" tabIndex={-1} className="mt-10 scroll-mt-4" aria-labelledby="current-position-title">
        <h2 id="current-position-title" className="text-xl font-bold">FIREの現在地</h2>
        <p className="mt-2 text-sm text-gray-600">保存した設定から、目標への進捗と達成までの見通しを確認できます。</p>
        {!readFailed && settings ? <>
          <FireProgress settings={settings} />
          <FireForecast settings={settings} />
        </> : <p className="mt-4 text-sm text-gray-600">{readFailed
          ? "設定を取得できないため、現在地を表示できません。"
          : "まず下のFIRE設定を保存すると、進捗と予測が表示されます。"}</p>}
        {!readFailed && !settings && <a href="#fire-settings" className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">FIRE設定を入力する</a>}
      </section>
      <section id="fire-settings" tabIndex={-1} className="scroll-mt-4 mt-10 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm" aria-labelledby="settings-title">
        <h2 id="settings-title" className="text-xl font-bold">FIRE設定</h2>
        {readFailed ? (
          <p role="alert" className="mt-3 text-sm text-red-700">設定を取得できませんでした。時間をおいて再度お試しください。</p>
        ) : settings ? (
          <dl className="mt-4 space-y-4 text-sm">
            <div><dt className="text-gray-600">総資産</dt><dd className="mt-1 break-words font-medium">{settings.total_assets} 円</dd></div>
            <div><dt className="text-gray-600">年間支出</dt><dd className="mt-1 break-words font-medium">{settings.annual_expenses} 円</dd></div>
            <div><dt className="text-gray-600">毎月の積立額</dt><dd className="mt-1 break-words font-medium">{settings.monthly_contribution} 円</dd></div>
            <div><dt className="text-gray-600">想定利回り</dt><dd className="mt-1 font-medium">{settings.expected_return}%</dd></div>
            <div><dt className="text-gray-600">更新日時</dt><dd className="mt-1 break-words"><time dateTime={settings.updated_at}>{settings.updated_at}</time></dd></div>
          </dl>
        ) : <p className="mt-3 text-sm text-gray-600">設定はまだありません</p>}
        {!readFailed && <SettingsForm initial={settings} />}
      </section>
      {!readFailed && settings && <section id="future" tabIndex={-1} className="mt-10 scroll-mt-4" aria-labelledby="future-title">
        <h2 id="future-title" className="text-xl font-bold">将来予測</h2>
        <FireProjection settings={settings} />
      </section>}
      {!readFailed && settings && <ScenarioComparison key={JSON.stringify([settings.total_assets, settings.annual_expenses, settings.monthly_contribution, settings.expected_return])} settings={settings} />}
      <section id="asset-records" tabIndex={-1} className="mt-10 scroll-mt-4" aria-labelledby="asset-records-title">
        <h2 id="asset-records-title" className="text-xl font-bold">資産記録</h2>
        <p className="mt-2 text-sm text-gray-600">現在の資産を記録し、前回からの変化やこれまでの推移を確認できます。</p>
        <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm" aria-labelledby="history-record-title">
        <h3 id="history-record-title" className="text-lg font-semibold">現在の資産を履歴に記録</h3>
        <p className="mt-2 text-sm text-gray-600">記録はFIRE設定の保存とは別に行われます。</p>
        <AssetHistoryForm initialAssets={settings?.total_assets ?? null} />
        </section>
        <AssetChange />
      </section>
    </main>
  );
}
