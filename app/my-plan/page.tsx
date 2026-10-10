import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type FinancialSettings = {
  total_assets: number | string;
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
      .select("total_assets, annual_expenses, expected_return, updated_at")
      .maybeSingle();
    if (error) readFailed = true;
    else settings = data;
  } catch {
    readFailed = true;
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/" className="text-sm font-medium text-indigo-700 underline underline-offset-4">← FIREナビトップへ戻る</Link>
      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm" aria-labelledby="plan-title">
        <h1 id="plan-title" className="text-2xl font-bold text-gray-900">マイプラン</h1>
        <p className="mt-3 text-sm text-gray-600">ログイン済み</p>
        <p className="mt-1 break-all text-gray-900">{user.email ?? "メールアドレス未登録"}</p>
        <h2 className="mt-8 text-lg font-semibold">FIRE設定</h2>
        {readFailed ? (
          <p role="alert" className="mt-3 text-sm text-red-700">設定を取得できませんでした。時間をおいて再度お試しください。</p>
        ) : settings ? (
          <dl className="mt-4 space-y-4 text-sm">
            <div><dt className="text-gray-600">総資産</dt><dd className="mt-1 break-words font-medium">{settings.total_assets} 円</dd></div>
            <div><dt className="text-gray-600">年間支出</dt><dd className="mt-1 break-words font-medium">{settings.annual_expenses} 円</dd></div>
            <div><dt className="text-gray-600">想定利回り</dt><dd className="mt-1 font-medium">{settings.expected_return}%</dd></div>
            <div><dt className="text-gray-600">更新日時</dt><dd className="mt-1 break-words"><time dateTime={settings.updated_at}>{settings.updated_at}</time></dd></div>
          </dl>
        ) : <p className="mt-3 text-sm text-gray-600">設定はまだありません</p>}
      </section>
    </main>
  );
}
