import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Custom throttler guard that scopes rate limits by userId for authenticated
 * requests and falls back to IP address for unauthenticated ones.
 *
 * This prevents a single user from bypassing per-IP limits by rotating IPs,
 * and prevents IP-based limits from penalising all users behind a NAT.
 *
 * Set SKIP_THROTTLE=true to disable rate limiting (used in E2E tests so
 * the per-IP thresholds do not interfere with test assertions).
 */
@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  override async canActivate(context: ExecutionContext): Promise<boolean> {
    if (process.env.SKIP_THROTTLE === 'true') return true;
    return super.canActivate(context) as Promise<boolean>;
  }

  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const user = req['user'] as { sub?: string } | undefined;
    if (user?.sub) {
      return user.sub; // scope by authenticated userId
    }

    // Fall back to IP — handle proxies
    const forwarded = (req['headers'] as Record<string, string | undefined>)?.['x-forwarded-for'];
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }

    return (req['ip'] as string | undefined) ?? '0.0.0.0';
  }
}
