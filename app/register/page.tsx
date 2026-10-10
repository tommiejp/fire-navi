import AuthPage from "../components/AuthPage";

// Check the current session on every request, even when build-time Auth is unset.
export const dynamic = "force-dynamic";

export default function RegisterPage() {
  return <AuthPage mode="register" />;
}
