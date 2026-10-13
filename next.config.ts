import type { NextConfig } from "next";

const development = process.env.NODE_ENV === "development";

function supabaseOrigin(): string | null {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!value) return null;
  try {
    const url = new URL(value);
    const local = development && ["localhost", "127.0.0.1"].includes(url.hostname);
    if ((url.protocol !== "https:" && !(local && url.protocol === "http:")) ||
      url.username || url.password || url.search || url.hash || url.pathname !== "/" ||
      !/^[a-zA-Z0-9.:-]+$/.test(url.host)) throw new Error();
    return url.origin;
  } catch {
    // Do not include configuration values in errors or headers.
    throw new Error("Invalid public Supabase URL for security headers.");
  }
}

const nextConfig: NextConfig = {
  async headers() {
    const origin = supabaseOrigin();
    const connect = ["'self'", ...(origin ? [origin] : [])];
    if (development) {
      const port = /^\d+$/.test(process.env.PORT ?? "") ? process.env.PORT : "3000";
      connect.push(`ws://localhost:${port}`, `ws://127.0.0.1:${port}`);
    }
    // Stage 1: enforce low-risk restrictions. No nonce/runtime/auth changes.
    const enforced = "object-src 'none'; base-uri 'self'; frame-ancestors 'none'";
    // Stage 2 candidate: reports only until inline Next.js scripts/styles have
    // a tested nonce/hash solution. Do not mistake Report-Only for protection.
    const reportOnly = [
      "default-src 'self'",
      `script-src 'self'${development ? " 'unsafe-eval'" : ""}`,
      "style-src 'self'",
      "img-src 'self'",
      "font-src 'self'",
      `connect-src ${connect.join(" ")}`,
      "frame-src 'none'",
      "form-action 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
    ].join("; ");
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: enforced },
          { key: "Content-Security-Policy-Report-Only", value: reportOnly },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        source: "/auth/callback",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
    ];
  },
};

export default nextConfig;
