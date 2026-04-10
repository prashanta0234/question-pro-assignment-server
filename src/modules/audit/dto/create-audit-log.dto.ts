import { AuditAction } from '../enums/audit-action.enum';

export interface CreateAuditLogDto {
  userId?: string;
  userRole: string;
  action: AuditAction;
  entity: string;
  entityId?: string;
  beforeData?: Record<string, unknown>;
  afterData?: Record<string, unknown>;
  ipAddress: string;
  userAgent?: string;
  requestId: string;
  status: 'SUCCESS' | 'FAILURE';
  failureReason?: string;
  metadata?: Record<string, unknown>;
}
