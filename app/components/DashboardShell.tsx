import Link from "next/link";
import FireCalculator from "./FireCalculator";

export default function DashboardShell() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-20 shadow-sm">
        <div className="max-w-xl mx-auto px-4 py-3.5 flex items-center gap-3">
          <div className="w-9 h-9 shrink-0 bg-indigo-600 rounded-xl flex items-center justify-center text-white text-xl" aria-hidden="true">☀</div>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-bold text-gray-900">FIREナビ</h1>
            <p className="text-xs text-gray-500">資産と支出から、FIREの目安を計算</p>
          </div>
          <Link href="/login" className="shrink-0 rounded-lg px-3 py-3 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
            ログイン
          </Link>
        </div>
      </header>
      <main className="max-w-xl w-full mx-auto px-4 pt-5 pb-8">
        <FireCalculator />
      </main>
    </div>
  );
}
