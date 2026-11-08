import Link from "next/link";

export default function Loading() {
  return <main className="mx-auto max-w-2xl px-4 py-10">
    <Link href="/" className="inline-flex min-h-11 items-center text-sm font-medium text-indigo-700 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">← FIREナビトップへ戻る</Link>
    <h1 className="mt-6 text-2xl font-bold text-gray-900">マイプラン</h1>
    <p role="status" aria-live="polite" className="mt-3 text-sm text-gray-600">マイプランを読み込んでいます…</p>
    <div aria-hidden="true" className="mt-10 space-y-8 motion-safe:animate-pulse">
      {["FIREの現在地", "FIRE設定", "将来予測", "シナリオ比較", "資産記録"].map(title =>
        <div key={title} className="min-w-0 rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
          <div className="text-lg font-semibold text-gray-600">{title}</div>
          <div className="mt-4 h-6 w-2/3 rounded bg-gray-100" />
          <div className="mt-3 h-4 w-full rounded bg-gray-100" />
          <div className="mt-3 h-4 w-1/2 rounded bg-gray-100" />
        </div>)}
    </div>
  </main>;
}
