export interface RequestContext {
  userId?: string;
  userRole: string;
  ipAddress: string;
  userAgent?: string;
  requestId: string;
}
