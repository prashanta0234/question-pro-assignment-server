import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';

const SENSITIVE_FIELDS = new Set(['password', 'token', 'secret', 'authorization', 'refreshtoken']);

function sanitizeForAudit(data: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(data).filter(([key]) => !SENSITIVE_FIELDS.has(key.toLowerCase())),
  );
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  async log(dto: CreateAuditLogDto): Promise<void> {
    try {
      const entry = this.auditRepo.create({
        userId: dto.userId ?? null,
        userRole: dto.userRole,
        action: dto.action,
        entity: dto.entity,
        entityId: dto.entityId ?? null,
        beforeData: dto.beforeData ? sanitizeForAudit(dto.beforeData) : null,
        afterData: dto.afterData ? sanitizeForAudit(dto.afterData) : null,
        ipAddress: dto.ipAddress,
        userAgent: dto.userAgent ?? null,
        requestId: dto.requestId,
        status: dto.status,
        failureReason: dto.failureReason ?? null,
        metadata: dto.metadata ?? null,
      });

      await this.auditRepo.save(entry);
    } catch (error) {
      this.logger.error({ error, dto }, 'AUDIT_LOG_WRITE_FAILED');
    }
  }
}
