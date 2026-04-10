import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Custom throttler guard that scopes rate limits by userId for authenticated
 * requests and falls back to IP address for unauthenticated ones.
 *
 * This prevents a single user from bypassing per-IP limits by rotating IPs,
 * and prevents IP-based limits from penalising all users behind a NAT.
 */
@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
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
