type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

declare global {
  var cbaRateLimitStore: Map<string, RateLimitEntry> | undefined;
}

const store = globalThis.cbaRateLimitStore || new Map<string, RateLimitEntry>();
globalThis.cbaRateLimitStore = store;

function pruneExpiredEntries(now: number) {
  if (store.size < 500) return;
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) store.delete(key);
  }
}

export function clientAddress(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

export function consumeRateLimit({ key, limit, windowMs }: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  pruneExpiredEntries(now);

  const current = store.get(key);
  const entry = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
  entry.count += 1;
  store.set(key, entry);

  return {
    allowed: entry.count <= limit,
    remaining: Math.max(0, limit - entry.count),
    retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000))
  };
}

export function clearRateLimit(key: string) {
  store.delete(key);
}

export function isSameOriginRequest(request: Request) {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return true;

  const requestUrl = new URL(request.url);
  const allowedOrigins = new Set([requestUrl.origin]);
  const forwardedHost = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const forwardedProtocol = request.headers.get("x-forwarded-proto") || requestUrl.protocol.replace(":", "");
  if (forwardedHost) allowedOrigins.add(`${forwardedProtocol}://${forwardedHost}`);

  const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (configuredAppUrl) {
    try {
      allowedOrigins.add(new URL(configuredAppUrl).origin);
    } catch {
      // Invalid configuration is ignored; request-derived origins remain enforced.
    }
  }

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return allowedOrigins.has(new URL(origin).origin);
    } catch {
      return false;
    }
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  return fetchSite !== "cross-site";
}
