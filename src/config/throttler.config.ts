import { ThrottlerModuleOptions } from '@nestjs/throttler';

/**
 * Named throttler limiters — applied per-route via @Throttle({ <name>: { ... } })
 * or globally via APP_GUARD with ThrottlerGuard.
 *
 * All ttl values are in milliseconds (throttler v6+).
 */
export const throttlerConfig: ThrottlerModuleOptions = {
  throttlers: [
    {
      name: 'global',
      ttl: 60_000,  // 1 minute
      limit: 100,   // 100 req/min per IP — catches scrapers/crawlers
    },
    {
      name: 'login',
      ttl: 60_000,
      limit: 10,    // 10 req/min per IP — brute-force protection
    },
    {
      name: 'register',
      ttl: 60_000,
      limit: 5,     // 5 req/min per IP — prevents account spam
    },
    {
      name: 'orders',
      ttl: 60_000,
      limit: 20,    // 20 req/min per authenticated user — prevents order flooding
    },
  ],
};
