/**
 * ログインページ（サーバーコンポーネント）
 *
 * LoginForm（クライアントコンポーネント）を配信する。
 * ログイン後は /dashboard へ遷移する。
 */
import LoginForm from "./components/LoginForm";

export default function LoginPage() {
  return <LoginForm />;
}
