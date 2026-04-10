import { CustomThrottlerGuard } from '../throttler.guard';

describe('CustomThrottlerGuard', () => {
  let guard: CustomThrottlerGuard;

  beforeEach(() => {
    // Bypass ThrottlerGuard constructor which needs ThrottlerStorage
    guard = Object.create(CustomThrottlerGuard.prototype) as CustomThrottlerGuard;
  });

  describe('getTracker()', () => {
    const getTracker = (req: Record<string, unknown>): Promise<string> =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (guard as any).getTracker(req);

    it('should return userId when user is authenticated', async () => {
      const userId = 'user-uuid-123';
      const req = { user: { sub: userId }, ip: '1.2.3.4', headers: {} };

      const tracker = await getTracker(req);

      expect(tracker).toBe(userId);
    });

    it('should fall back to IP when user is not authenticated', async () => {
      const req = { user: undefined, ip: '9.8.7.6', headers: {} };

      const tracker = await getTracker(req);

      expect(tracker).toBe('9.8.7.6');
    });

    it('should extract first IP from X-Forwarded-For header (proxy-aware)', async () => {
      const req = {
        user: undefined,
        ip: '127.0.0.1', // proxy IP — not the real client
        headers: { 'x-forwarded-for': '203.0.113.5, 10.0.0.1, 172.16.0.1' },
      };

      const tracker = await getTracker(req);

      expect(tracker).toBe('203.0.113.5');
    });

    it('should prefer userId over X-Forwarded-For for authenticated requests', async () => {
      const userId = 'auth-user-abc';
      const req = {
        user: { sub: userId },
        ip: '1.1.1.1',
        headers: { 'x-forwarded-for': '5.5.5.5' },
      };

      const tracker = await getTracker(req);

      expect(tracker).toBe(userId); // userId always wins for authenticated requests
    });

    it('should return 0.0.0.0 as fallback when no user, no IP, no header', async () => {
      const req = { user: undefined, ip: undefined, headers: {} };

      const tracker = await getTracker(req);

      expect(tracker).toBe('0.0.0.0');
    });
  });
});
