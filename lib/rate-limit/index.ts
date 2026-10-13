import "server-only";
import { upstashStore } from "./upstash";
import type { RateLimitAction, RateLimitResult, RateLimitStore } from "./types";

const limits: Record<RateLimitAction, number> = {
  saveFinancialSettings: 20,
  recordCurrentAssets: 10,
  updateProfile: 10,
};

export function createRateLimiter(store: RateLimitStore) {
  return async (action: RateLimitAction, verifiedUserId: string): Promise<RateLimitResult> => {
    try {
      const key = `fire-navi:rate-limit:v1:${action}:${verifiedUserId}`;
      const count = await store.incrementWithTtl(key, 60);
      if (!Number.isSafeInteger(count) || count < 1) return "SERVER_ERROR";
      return count <= limits[action] ? "ALLOWED" : "RATE_LIMITED";
    } catch {
      return "SERVER_ERROR";
    }
  };
}

export const checkRateLimit = createRateLimiter(upstashStore);
