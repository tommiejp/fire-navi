/**
 * ダッシュボードページ（サーバーコンポーネント）
 *
 * AuthGuard でアクセス制御し、
 * DashboardShell（共有ヘッダー + タブナビ + 各コンテンツ）を配信する。
 */
import AuthGuard from "../components/AuthGuard";
import DashboardShell from "../components/DashboardShell";

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardShell />
    </AuthGuard>
  );
}
