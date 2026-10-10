import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export function proxy(request: NextRequest) {
  return updateSession(request);
}

// Session refresh only, not authorization. Callback owns its code exchange.
// Extend this list when adding any other route that reads an auth session.
export const config = {
  matcher: [
    "/login/:path*",
    "/register/:path*",
    "/my-plan/:path*",
    "/history/:path*",
    "/account/:path*",
  ],
};
