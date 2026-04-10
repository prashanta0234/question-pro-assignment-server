import { Request } from 'express';
import { RequestContext } from '../interfaces/request-context.interface';

interface RequestWithMeta {
  id?: string;
  user?: { sub?: string; role?: string };
  headers: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
}

export function extractRequestCtx(req: Request & { id?: string }): RequestContext {
  const r = req as unknown as RequestWithMeta;

  const ip =
    (r.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
    r.socket?.remoteAddress ??
    '0.0.0.0';

  return {
    userId: r.user?.sub,
    userRole: r.user?.role ?? 'SYSTEM',
    ipAddress: ip.substring(0, 45),
    userAgent: (r.headers['user-agent'] as string | undefined)?.substring(0, 255) || undefined,
    requestId: r.id ?? crypto.randomUUID(),
  };
}
