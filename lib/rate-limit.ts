import { RateLimiterMemory, RateLimiterRedis, type RateLimiterAbstract } from 'rate-limiter-flexible';
import Redis from 'ioredis';

const rateLimiters = new Map<string, RateLimiterAbstract>();
let redisClient: Redis | null = null;

function getRedisClient(): Redis | null {
  if (redisClient) return redisClient;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;

  try {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      // Gagal cepat saat Redis tidak terjangkau agar request tidak tertahan;
      // limiter otomatis turun ke in-memory (insuranceLimiter).
      connectTimeout: 2000,
      commandTimeout: 500,
    });
    redisClient.on('error', () => {
      redisClient = null;
    });
    redisClient.on('connect', () => {
      console.log('[RateLimit] Redis connected');
    });
  } catch {
    redisClient = null;
  }

  return redisClient;
}

function getLimiter(key: string, points: number, duration: number): RateLimiterAbstract {
  if (!rateLimiters.has(key)) {
    const redis = getRedisClient();

    if (redis) {
      rateLimiters.set(key, new RateLimiterRedis({
        storeClient: redis,
        points,
        duration,
        keyPrefix: `ratelimit:${key}`,
        // Jika Redis down / URL salah, jangan blokir semua request (login,
        // search, booking): turun ke limiter in-memory per instance.
        insuranceLimiter: new RateLimiterMemory({ points, duration }),
      }));
    } else {
      rateLimiters.set(key, new RateLimiterMemory({
        points,
        duration,
      }));
    }
  }

  return rateLimiters.get(key)!;
}

export async function checkRateLimit(
  identifier: string,
  type: 'search' | 'auth' | 'login' | 'loginIp' | 'booking' | 'general' = 'general'
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const configs = {
    search: { points: 50, duration: 60 },      // 50 requests per minute (7 providers paralel)
    auth: { points: 5, duration: 300 },         // 5 requests per 5 minutes
    login: { points: 5, duration: 300 },        // 5 percobaan login per 5 menit (per IP + email)
    loginIp: { points: 30, duration: 300 },     // 30 percobaan login per IP per 5 menit
    booking: { points: 30, duration: 60 },      // 30 requests per minute (untuk polling)
    general: { points: 30, duration: 60 },      // 30 requests per minute
  };

  const config = configs[type];
  const limiter = getLimiter(type, config.points, config.duration);

  try {
    await limiter.consume(identifier);
    return { allowed: true };
  } catch (rejRes) {
    // `rate-limiter-flexible` melempar RateLimiterRes saat kuota habis, tetapi
    // melempar Error biasa saat store (Redis) bermasalah. Error infrastruktur
    // tidak boleh dianggap "kena limit" — kalau tidak, satu gangguan Redis
    // menolak seluruh login/search/booking.
    if (rejRes instanceof Error) {
      console.error('[RateLimit] Store error, request dilewatkan:', rejRes.message);
      return { allowed: true };
    }
    const msBeforeNext = (rejRes as { msBeforeNext?: number })?.msBeforeNext ?? 0;
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil(msBeforeNext / 1000)),
    };
  }
}

// FIX (Bug #4): sama seperti `getRequestIp` di lib/security.ts — pakai header
// yang di-set oleh platform (tidak bisa dispoof client) sebelum fallback ke
// `x-forwarded-for` biasa, agar rate limit tidak mudah dilewati dengan
// spoofing IP di header.
export function getClientIp(req: Request): string {
  const trustedVercel = req.headers.get('x-vercel-forwarded-for');
  if (trustedVercel) {
    return trustedVercel.split(',')[0].trim();
  }
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.headers.get('x-real-ip') || 'unknown';
}
