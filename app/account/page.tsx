import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";
import ProfileForm from "./ProfileForm";
import LogoutForm from "./LogoutForm";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
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
  let profile: { display_name: string; created_at: string } | null = null;
  let readFailed = false;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("profiles")
      .select("display_name, created_at").maybeSingle();
    if (error) readFailed = true;
    else profile = data;
  } catch {
    readFailed = true;
  }
  return <main className="mx-auto max-w-2xl px-4 py-10">
    <nav aria-label="ページ移動" className="flex flex-wrap gap-4 text-sm text-indigo-700 underline underline-offset-4">
      <Link href="/my-plan">マイプラン</Link>
      <Link href="/history">資産履歴</Link>
      <Link href="/">FIREナビトップへ戻る</Link>
    </nav>
    <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm" aria-labelledby="account-title">
      <h1 id="account-title" className="text-2xl font-bold">アカウント</h1>
      <p className="mt-4 text-sm text-gray-600">ログイン中のメールアドレス</p>
      <p className="mt-1 break-all">{user.email ?? "メールアドレス未登録"}</p>
      {readFailed ? <p role="alert" className="mt-4 text-sm text-red-700">プロフィールを取得できませんでした。時間をおいて再度お試しください。</p> : <>
        {!profile && <p className="mt-4 text-sm text-gray-600">プロフィールはまだありません。</p>}
        <ProfileForm initialName={profile?.display_name ?? ""} />
      </>}
      <LogoutForm />
    </section>
  </main>;
}
