import "server-only";
import type { RateLimitStore } from "./types";

const script = `local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return count`;

export const upstashStore: RateLimitStore = {
  async incrementWithTtl(key, ttlSeconds) {
    try {
      const endpoint = process.env.KV_REST_API_URL;
      const token = process.env.KV_REST_API_TOKEN;
      if (!endpoint || !token || !Number.isSafeInteger(ttlSeconds) || ttlSeconds <= 0) throw new Error();
      const url = new URL(endpoint);
      if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new Error();
      // One request, no retry: a timeout may occur after Redis already incremented.
      const response = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(["EVAL", script, 1, key, ttlSeconds]),
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error();
      const body: unknown = await response.json();
      if (!body || typeof body !== "object" || "error" in body || !("result" in body)) throw new Error();
      const count = body.result;
      if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 1) throw new Error();
      return count;
    } catch {
      // Do not expose tokens, endpoint details, response bodies or fetch errors.
      throw new Error("Rate limit store unavailable.");
    }
  },
};
