import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const allowedPaths = new Set(["/", "/my-plan", "/history", "/account"]);

function appOrigin() {
  // Never derive the destination origin from request / forwarded Host headers.
  const url = new URL(process.env.APP_ORIGIN || "https://fire-navi.vercel.app");
  if (
    url.username || url.password || url.pathname !== "/" || url.search || url.hash ||
    (url.protocol !== "https:" &&
      !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))
  ) {
    throw new Error("Invalid APP_ORIGIN configuration.");
  }
  return url.origin;
}

export async function GET(request: Request) {
  const origin = appOrigin();
  const params = new URL(request.url).searchParams;
  const response = NextResponse.redirect(new URL("/login?error=auth", origin));
  response.headers.set("Cache-Control", "private, no-store");
  const code = params.get("code");
  if (!code || params.has("error")) return response;

  const requestedPath = params.get("next");
  const path = requestedPath && allowedPaths.has(requestedPath) ? requestedPath : "/my-plan";
  try {
    const supabase = await createClient({ writableCookies: true, responseHeaders: response.headers });
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) response.headers.set("Location", new URL(path, origin).toString());
  } catch {
    // Keep the generic failure redirect; never log codes, tokens or raw errors.
  }
  return response;
}
