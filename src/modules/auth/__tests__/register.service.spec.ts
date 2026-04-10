import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuditService } from '../../audit/audit.service';
import { AuditAction } from '../../audit/enums/audit-action.enum';
import { UsersService } from '../../users/users.service';
import { RegisterService } from '../register.service';
import { RegisterDto } from '../dto/register.dto';
import { buildUser } from '../../../test/factories/user.factory';
import { buildRequestCtx } from '../../../test/factories/request-context.factory';
import { mockAuditService, mockJwtService } from '../../../test/mocks/repository.mock';
import { Role } from '../../users/enums/role.enum';

describe('RegisterService', () => {
  let service: RegisterService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: ReturnType<typeof mockJwtService>;
  let auditService: ReturnType<typeof mockAuditService>;

  const dto: RegisterDto = { email: 'new@test.com', password: 'Secure@1234' };
  const ctx = buildRequestCtx({ userRole: 'SYSTEM' });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegisterService,
        {
          provide: UsersService,
          useValue: {
            findByEmail: jest.fn(),
            create: jest.fn(),
          },
        },
        { provide: JwtService, useFactory: mockJwtService },
        { provide: AuditService, useFactory: mockAuditService },
      ],
    }).compile();

    service = module.get(RegisterService);
    usersService = module.get(UsersService) as jest.Mocked<UsersService>;
    jwtService = module.get(JwtService);
    auditService = module.get(AuditService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('execute()', () => {
    it('should return an accessToken on successful registration', async () => {
      const user = buildUser({ email: dto.email, role: Role.USER });
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue(user);
      jwtService.sign.mockReturnValue('signed.jwt.token');

      const result = await service.execute(dto, ctx);

      expect(result).toEqual({ accessToken: 'signed.jwt.token' });
    });

    it('should call usersService.create with email and password', async () => {
      const user = buildUser({ email: dto.email });
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue(user);

      await service.execute(dto, ctx);

      expect(usersService.create).toHaveBeenCalledWith({
        email: dto.email,
        password: dto.password,
      });
    });

    it('should sign JWT with correct payload (sub, email, role)', async () => {
      const user = buildUser({ email: dto.email, role: Role.USER });
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue(user);

      await service.execute(dto, ctx);

      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: user.id,
        email: user.email,
        role: user.role,
      });
    });

    it('should throw ConflictException when email already exists', async () => {
      usersService.findByEmail.mockResolvedValue(buildUser({ email: dto.email }));

      await expect(service.execute(dto, ctx)).rejects.toThrow(ConflictException);
      expect(usersService.create).not.toHaveBeenCalled();
    });

    it('should include CONFLICT error code in exception response', async () => {
      usersService.findByEmail.mockResolvedValue(buildUser({ email: dto.email }));

      try {
        await service.execute(dto, ctx);
        fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ConflictException);
        const response = (err as ConflictException).getResponse() as Record<string, unknown>;
        expect(response.error).toBe('CONFLICT');
        expect(response.message).toBe('Email already registered');
      }
    });

    it('should log USER_REGISTERED with SUCCESS on successful registration', async () => {
      const user = buildUser({ email: dto.email });
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue(user);

      await service.execute(dto, ctx);

      // Allow void promise to settle
      await new Promise((r) => setImmediate(r));

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.USER_REGISTERED,
          entity: 'User',
          entityId: user.id,
          status: 'SUCCESS',
          afterData: expect.objectContaining({ id: user.id, email: user.email }),
        }),
      );
    });

    it('should log USER_REGISTERED with FAILURE when email already exists', async () => {
      usersService.findByEmail.mockResolvedValue(buildUser({ email: dto.email }));

      await expect(service.execute(dto, ctx)).rejects.toThrow(ConflictException);
      await new Promise((r) => setImmediate(r));

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.USER_REGISTERED,
          status: 'FAILURE',
          failureReason: 'Email already exists',
        }),
      );
    });

    it('should NOT log SUCCESS audit entry when email is taken', async () => {
      usersService.findByEmail.mockResolvedValue(buildUser({ email: dto.email }));

      await expect(service.execute(dto, ctx)).rejects.toThrow();
      await new Promise((r) => setImmediate(r));

      // Only one log call (the FAILURE one), not a success
      expect(auditService.log).toHaveBeenCalledTimes(1);
      expect(auditService.log).not.toHaveBeenCalledWith(
        expect.objectContaining({ status: 'SUCCESS' }),
      );
    });

    it('should propagate DB errors from usersService.create', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockRejectedValue(new Error('DB connection lost'));

      await expect(service.execute(dto, ctx)).rejects.toThrow('DB connection lost');
    });
  });
});
