import AuthPage from "../components/AuthPage";

// Check the current session on every request, even when build-time Auth is unset.
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const params = await searchParams;
  return <AuthPage mode="login" callbackFailed={params.error === "auth"} />;
}
