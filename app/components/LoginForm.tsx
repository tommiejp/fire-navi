"use client";

/**
 * LoginForm
 * ─────────────────────────────────────────────────────
 * FIREナビのログイン画面コンポーネント。
 *
 * 仕様：
 *   - メールアドレス + パスワードのフォーム
 *   - 未入力チェックのみ（デモ用のため認証不要）
 *   - ログイン成功後は localStorage に認証情報を保存して
 *     /dashboard へ遷移
 *   - 既にログイン済みの場合は /dashboard へリダイレクト
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// ─── 定数 ──────────────────────────────────────────────
const AUTH_STORAGE_KEY = "fire_navi_auth";

// ─── 型定義 ────────────────────────────────────────────
interface AuthState {
  isLoggedIn: boolean;
  email: string;
}

// ─── メインコンポーネント ──────────────────────────────
export default function LoginForm() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true); // 認証確認中フラグ

  // ── マウント時：既ログインなら即ダッシュボードへ
  useEffect(() => {
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      if (saved) {
        const auth: AuthState = JSON.parse(saved);
        if (auth.isLoggedIn) {
          router.replace("/dashboard");
          return;
        }
      }
    } catch {
      // 無視
    }
    setIsChecking(false);
  }, [router]);

  // ── ログイン処理
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // バリデーション
    if (!email.trim()) {
      setError("メールアドレスを入力してください");
      return;
    }
    if (!email.includes("@")) {
      setError("正しいメールアドレスを入力してください");
      return;
    }
    if (!password.trim()) {
      setError("パスワードを入力してください");
      return;
    }
    if (password.length < 6) {
      setError("パスワードは6文字以上で入力してください");
      return;
    }

    // ローディング演出（UX向上のため300ms待機）
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 600));

    // 認証情報を localStorage に保存
    const authState: AuthState = { isLoggedIn: true, email: email.trim() };
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authState));

    // ダッシュボードへ遷移
    router.push("/dashboard");
  };

  // 認証確認中はブランク表示（チラつき防止）
  if (isChecking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-700 via-indigo-600 to-purple-700 flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin opacity-60" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-700 via-indigo-600 to-purple-700 flex flex-col items-center justify-center px-4 py-12">

      {/* ── 背景の装飾サークル */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden>
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-purple-500 rounded-full opacity-20 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-indigo-400 rounded-full opacity-20 blur-3xl" />
      </div>

      {/* ── ロゴ＋タイトル */}
      <div className="text-center mb-8 relative z-10">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl mb-4 shadow-lg">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="w-8 h-8 text-white"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 3v1m0 16v1m8-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707"
            />
            <circle cx="12" cy="12" r="4" />
          </svg>
        </div>
        <h1 className="text-3xl font-black text-white tracking-tight">FIREナビ</h1>
        <p className="text-indigo-200 text-sm mt-1">
          Financial Independence, Retire Early
        </p>
      </div>

      {/* ── ログインカード */}
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-7 relative z-10">

        <h2 className="text-xl font-bold text-gray-900 mb-1">ログイン</h2>
        <p className="text-sm text-gray-500 mb-6">
          アカウントにサインインしてください
        </p>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">

          {/* メールアドレス */}
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-1.5"
            >
              メールアドレス
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError("");
              }}
              placeholder="you@example.com"
              className="
                w-full border border-gray-200 rounded-xl px-4 py-3
                text-gray-900 placeholder-gray-400 text-sm
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                bg-gray-50 hover:bg-white transition-colors
              "
            />
          </div>

          {/* パスワード */}
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1.5"
            >
              パスワード
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              placeholder="••••••••"
              className="
                w-full border border-gray-200 rounded-xl px-4 py-3
                text-gray-900 placeholder-gray-400 text-sm
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                bg-gray-50 hover:bg-white transition-colors
              "
            />
          </div>

          {/* エラーメッセージ */}
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              <svg
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                  clipRule="evenodd"
                />
              </svg>
              <p className="text-red-600 text-xs leading-relaxed">{error}</p>
            </div>
          )}

          {/* ログインボタン */}
          <button
            type="submit"
            disabled={isLoading}
            className="
              w-full bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800
              disabled:bg-indigo-400
              text-white font-semibold text-sm
              rounded-xl py-3.5 mt-2
              transition-colors duration-150
              flex items-center justify-center gap-2
              shadow-md shadow-indigo-200
            "
          >
            {isLoading ? (
              <>
                <svg
                  className="w-4 h-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"
                  />
                </svg>
                ログイン中…
              </>
            ) : (
              "ログイン"
            )}
          </button>
        </form>

        {/* デモ用ヒント */}
        <div className="mt-5 bg-indigo-50 rounded-2xl p-4">
          <p className="text-xs font-semibold text-indigo-700 mb-1.5">
            💡 デモ用アカウント
          </p>
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => {
                setEmail("demo@fire-navi.app");
                setPassword("password123");
                setError("");
              }}
              className="w-full text-left"
            >
              <div className="flex justify-between text-xs text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer">
                <span className="text-indigo-500">メール：</span>
                <span className="font-mono font-medium">demo@fire-navi.app</span>
              </div>
              <div className="flex justify-between text-xs text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer mt-0.5">
                <span className="text-indigo-500">パスワード：</span>
                <span className="font-mono font-medium">password123</span>
              </div>
            </button>
          </div>
          <p className="text-[10px] text-indigo-400 mt-2">
            ↑ タップで自動入力
          </p>
        </div>
      </div>

      {/* フッター */}
      <p className="text-indigo-300 text-xs mt-8 text-center relative z-10">
        © 2026 FIREナビ — シミュレーションは参考情報です
      </p>
    </div>
  );
}
