const windowMs = 60 * 1000; // 1 minute
const limits: Record<string, { count: number; resetAt: number }> = {};

export function checkRateLimit(key: string, maxRequests: number): void {
  const now = Date.now();
  const entry = limits[key];

  if (!entry || now > entry.resetAt) {
    limits[key] = { count: 1, resetAt: now + windowMs };
    return;
  }

  entry.count++;
  if (entry.count > maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    throw new Error(`Rate limit exceeded. Try again in ${retryAfter} seconds.`);
  }
}
