"use client";

/**
 * DashboardShell
 * ─────────────────────────────────────────────────────
 * ログイン済みユーザー向けのダッシュボード全体レイアウト。
 *
 * 役割：
 *   - 共有ヘッダー（ロゴ・ユーザーメール・ログアウト）
 *   - ボトムタブナビゲーション（無料 / PRO）
 *   - タブに応じたコンテンツ切り替え
 *
 * タブ構成：
 *   シミュレーター（FREE）  … FireCalculator
 *   資産トラッキング（PRO） … AssetTracker
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import FireCalculator from "./FireCalculator";
import ScenarioSimulator from "./ScenarioSimulator";
import AssetManager from "./AssetManager";

// ─── 定数 ──────────────────────────────────────────────
const AUTH_STORAGE_KEY = "fire_navi_auth";

type TabId = "simulator" | "scenario" | "assets";

// ─── タブ定義 ──────────────────────────────────────────
const TABS: Array<{
  id: TabId;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  badge?: string;
}> = [
  {
    id: "simulator",
    label: "FIREシミュレーター",
    shortLabel: "FIRE計算",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    id: "scenario",
    label: "拡張シミュレーション",
    shortLabel: "シナリオ",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
      </svg>
    ),
    badge: "PRO",
  },
  {
    id: "assets",
    label: "資産詳細管理",
    shortLabel: "資産管理",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 5.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
      </svg>
    ),
    badge: "PRO",
  },
];

// ─── メインコンポーネント ──────────────────────────────
export default function DashboardShell() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("simulator");
  const [userEmail, setUserEmail] = useState<string>("");

  // ユーザーメール取得
  useEffect(() => {
    try {
      const authData = localStorage.getItem(AUTH_STORAGE_KEY);
      if (authData) {
        const auth = JSON.parse(authData);
        if (auth.email) setUserEmail(auth.email);
      }
    } catch { /* ignore */ }
  }, []);

  // ログアウト処理
  const handleLogout = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* ════════════════════════════════════
          共有ヘッダー（sticky）
          ════════════════════════════════════ */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-20 shadow-sm flex-shrink-0">
        <div className="max-w-xl mx-auto px-4 py-3.5 flex items-center gap-3">

          {/* ロゴアイコン */}
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-white" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m8-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707" />
              <circle cx="12" cy="12" r="4" />
            </svg>
          </div>

          {/* タイトル＆ユーザー情報 */}
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-gray-900 leading-tight">FIREナビ</h1>
            <p className="text-[11px] text-gray-400 leading-none truncate">
              {userEmail || "Financial Independence, Retire Early"}
            </p>
          </div>

          {/* ログアウトボタン */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-500 hover:bg-red-50 active:bg-red-100 rounded-xl px-3 py-2 transition-colors flex-shrink-0"
            title="ログアウト"
          >
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10H3m0 0l3-3m-3 3l3 3M9 6.5V5a2 2 0 012-2h4a2 2 0 012 2v10a2 2 0 01-2 2h-4a2 2 0 01-2-2v-1.5" />
            </svg>
            <span className="hidden sm:inline">ログアウト</span>
          </button>
        </div>
      </header>

      {/* ════════════════════════════════════
          タブコンテンツ
          ════════════════════════════════════ */}
      <main className="flex-1 max-w-xl w-full mx-auto px-4 pt-5 pb-24 space-y-4">
        {activeTab === "simulator" && <FireCalculator />}
        {activeTab === "scenario"  && <ScenarioSimulator />}
        {activeTab === "assets"    && <AssetManager />}
      </main>

      {/* ════════════════════════════════════
          ボトムタブバー（fixed）
          ════════════════════════════════════ */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        <div className="max-w-xl mx-auto flex">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex-1 flex flex-col items-center justify-center gap-1
                  py-3 px-2 relative transition-colors
                  ${isActive ? "text-indigo-600" : "text-gray-400 hover:text-gray-600"}
                `}
              >
                {/* アクティブインジケーター */}
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-0.5 bg-indigo-600 rounded-full" />
                )}

                {/* アイコン */}
                <span className={isActive ? "text-indigo-600" : "text-gray-400"}>
                  {tab.icon}
                </span>

                {/* ラベル + バッジ */}
                <span className="flex items-center gap-1 text-[11px] font-medium leading-none">
                  {tab.shortLabel}
                  {tab.badge && (
                    <span className="bg-gradient-to-r from-amber-400 to-orange-400 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                      {tab.badge}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
        {/* iPhone ホームバー対応 */}
        <div className="h-safe-area-inset-bottom" style={{ paddingBottom: "env(safe-area-inset-bottom)" }} />
      </nav>
    </div>
  );
}
