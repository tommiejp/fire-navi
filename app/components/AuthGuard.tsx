"use client";

/**
 * AuthGuard
 * ─────────────────────────────────────────────────────
 * ダッシュボードを保護するラッパーコンポーネント。
 *
 * - localStorage の認証情報を確認
 * - 未ログインの場合は / へリダイレクト
 * - ログイン済みの場合は children を表示
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const AUTH_STORAGE_KEY = "fire_navi_auth";

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      if (saved) {
        const auth = JSON.parse(saved);
        if (auth.isLoggedIn === true) {
          setIsAuthorized(true);
          return;
        }
      }
    } catch {
      // パース失敗時は未認証として扱う
    }
    // 未ログイン → ログイン画面へ
    router.replace("/");
  }, [router]);

  // 認証確認中はローディングスピナーを表示
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-400">認証を確認中…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
