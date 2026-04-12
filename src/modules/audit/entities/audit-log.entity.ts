import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { AuditAction } from '../enums/audit-action.enum';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true, type: 'uuid' })
  userId: string | null;

  @Column({ type: 'enum', enum: ['ADMIN', 'USER', 'SYSTEM'] })
  userRole: string;

  @Column({ type: 'enum', enum: AuditAction })
  action: AuditAction;

  @Column({ length: 50 })
  entity: string;

  @Column({ nullable: true, type: 'uuid' })
  entityId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  beforeData: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  afterData: Record<string, unknown> | null;

  @Column({ length: 45 })
  ipAddress: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  userAgent: string | null;

  @Column({ length: 100 })
  requestId: string;

  @Column({ type: 'enum', enum: ['SUCCESS', 'FAILURE'] })
  status: string;

  @Column({ nullable: true, type: 'text' })
  failureReason: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;
}
