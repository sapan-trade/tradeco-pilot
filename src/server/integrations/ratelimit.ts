import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export interface RateLimiter {
  consume(key: string, limit: number, windowMs: number): Promise<RateLimitResult>;
}

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

class InMemoryRateLimiter implements RateLimiter {
  async consume(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now();
    const b = buckets.get(key);
    if (!b || b.resetAt <= now) {
      const fresh: Bucket = { count: 1, resetAt: now + windowMs };
      buckets.set(key, fresh);
      return { allowed: true, remaining: limit - 1, resetAt: fresh.resetAt };
    }
    if (b.count >= limit) {
      return { allowed: false, remaining: 0, resetAt: b.resetAt };
    }
    b.count++;
    return { allowed: true, remaining: limit - b.count, resetAt: b.resetAt };
  }
}

class UpstashRateLimiter implements RateLimiter {
  private redis: Redis;
  private cache = new Map<string, Ratelimit>();

  constructor(url: string, token: string) {
    this.redis = new Redis({ url, token });
  }

  private getLimiter(limit: number, windowMs: number): Ratelimit {
    const k = `${limit}:${windowMs}`;
    const hit = this.cache.get(k);
    if (hit) return hit;
    const lim = new Ratelimit({
      redis: this.redis,
      limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms` as `${number} ms`),
      analytics: false,
      prefix: "tradeco",
    });
    this.cache.set(k, lim);
    return lim;
  }

  async consume(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const r = await this.getLimiter(limit, windowMs).limit(key);
    return { allowed: r.success, remaining: r.remaining, resetAt: r.reset };
  }
}

let cached: RateLimiter | null = null;

export function getRateLimiter(): RateLimiter {
  if (cached) return cached;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const useReal = url && token && process.env.NODE_ENV !== "test";
  cached = useReal ? new UpstashRateLimiter(url, token) : new InMemoryRateLimiter();
  return cached;
}

export function resetRateLimiterForTests(): void {
  buckets.clear();
  cached = null;
}
