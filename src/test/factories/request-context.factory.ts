import { randomUUID } from 'crypto';
import { RequestContext } from '../../common/interfaces/request-context.interface';
import { Role } from '../../modules/users/enums/role.enum';

export const buildRequestCtx = (overrides: Partial<RequestContext> = {}): RequestContext => ({
  userId: randomUUID(),
  userRole: Role.USER,
  ipAddress: '127.0.0.1',
  userAgent: 'jest-test-agent',
  requestId: randomUUID(),
  ...overrides,
});

export const buildAdminCtx = (userId?: string): RequestContext =>
  buildRequestCtx({ userId: userId ?? randomUUID(), userRole: Role.ADMIN });
