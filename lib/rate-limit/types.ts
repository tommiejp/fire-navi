export type RateLimitAction = "saveFinancialSettings" | "recordCurrentAssets" | "updateProfile";

export interface RateLimitStore {
  /** Shared across instances. Atomically increment and return a positive count.
   * Set TTL only on creation (first request); later increments must not extend it.
   * Expired keys restart at 1. Increment + initial TTL must be a single atomic
   * operation (e.g. Redis Lua), never separate INCR and EXPIRE network calls.
   * Throw on timeout/unavailability; do not retry ambiguous increments blindly.
   */
  incrementWithTtl(key: string, ttlSeconds: number): Promise<number>;
}
export type RateLimitResult = "ALLOWED" | "RATE_LIMITED" | "SERVER_ERROR";
