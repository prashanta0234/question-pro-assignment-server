import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditService } from '../audit.service';
import { AuditLog } from '../entities/audit-log.entity';
import { AuditAction } from '../enums/audit-action.enum';
import { CreateAuditLogDto } from '../dto/create-audit-log.dto';
import { mockRepository } from '../../../test/mocks/repository.mock';
import { Role } from '../../users/enums/role.enum';

describe('AuditService', () => {
  let service: AuditService;
  let repo: ReturnType<typeof mockRepository>;

  const minimalDto: CreateAuditLogDto = {
    action: AuditAction.USER_LOGIN,
    entity: 'User',
    status: 'SUCCESS',
    userRole: Role.USER,
    ipAddress: '127.0.0.1',
    requestId: 'req-test-001',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: getRepositoryToken(AuditLog), useFactory: mockRepository },
      ],
    }).compile();

    service = module.get(AuditService);
    repo = module.get(getRepositoryToken(AuditLog));

    // Default: create returns the saved entity shape
    repo.create.mockImplementation((data) => ({ ...data }));
    repo.save.mockResolvedValue({ id: 'audit-uuid', ...minimalDto, createdAt: new Date() });
  });

  afterEach(() => jest.clearAllMocks());

  describe('log()', () => {
    it('should persist audit entry to the repository', async () => {
      await service.log(minimalDto);

      expect(repo.create).toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalled();
    });

    it('should strip password from beforeData before saving', async () => {
      await service.log({
        ...minimalDto,
        beforeData: { email: 'a@test.com', password: 'secret123' },
      });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          beforeData: expect.not.objectContaining({ password: expect.anything() }),
        }),
      );
    });

    it('should strip password from afterData before saving', async () => {
      await service.log({
        ...minimalDto,
        afterData: { email: 'b@test.com', password: 'newpassword' },
      });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          afterData: expect.not.objectContaining({ password: expect.anything() }),
        }),
      );
    });

    it('should preserve non-sensitive fields in beforeData', async () => {
      await service.log({
        ...minimalDto,
        beforeData: { email: 'c@test.com', role: Role.USER, password: 'stripped' },
      });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          beforeData: expect.objectContaining({ email: 'c@test.com', role: Role.USER }),
        }),
      );
    });

    it('should strip authorization and token fields too', async () => {
      await service.log({
        ...minimalDto,
        beforeData: {
          authorization: 'Bearer token123',
          token: 'raw-token',
          secret: 'api-secret',
          safeField: 'kept',
        },
      });

      const call = repo.create.mock.calls[0][0] as Record<string, unknown>;
      expect(call.beforeData).not.toHaveProperty('authorization');
      expect(call.beforeData).not.toHaveProperty('token');
      expect(call.beforeData).not.toHaveProperty('secret');
      expect((call.beforeData as Record<string, unknown>)['safeField']).toBe('kept');
    });

    it('should NOT throw when repository.save fails (best-effort, fire-and-forget)', async () => {
      repo.save.mockRejectedValue(new Error('audit DB down'));

      await expect(service.log(minimalDto)).resolves.not.toThrow();
    });

    it('should log error to application logger when audit write fails', async () => {
      repo.save.mockRejectedValue(new Error('connection refused'));
      const loggerSpy = jest.spyOn((service as any)['logger'], 'error').mockImplementation(() => {});

      await service.log(minimalDto);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.any(Error) }),
        'AUDIT_LOG_WRITE_FAILED',
      );
    });

    it('should store null beforeData and afterData when not provided', async () => {
      await service.log(minimalDto);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          beforeData: null,
          afterData: null,
        }),
      );
    });

    it('should correctly map all fields from the DTO', async () => {
      const fullDto: CreateAuditLogDto = {
        userId: 'user-uuid-1',
        userRole: Role.ADMIN,
        action: AuditAction.GROCERY_CREATED,
        entity: 'GroceryItem',
        entityId: 'item-uuid-1',
        status: 'SUCCESS',
        ipAddress: '10.0.0.1',
        userAgent: 'Mozilla/5.0',
        requestId: 'req-uuid-999',
        failureReason: undefined,
        metadata: { extra: 'info' },
      };

      await service.log(fullDto);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-uuid-1',
          userRole: Role.ADMIN,
          action: AuditAction.GROCERY_CREATED,
          entity: 'GroceryItem',
          entityId: 'item-uuid-1',
          status: 'SUCCESS',
          ipAddress: '10.0.0.1',
          userAgent: 'Mozilla/5.0',
          requestId: 'req-uuid-999',
        }),
      );
    });
  });
});
