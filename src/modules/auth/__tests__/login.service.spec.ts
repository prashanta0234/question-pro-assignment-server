import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuditService } from '../../audit/audit.service';
import { AuditAction } from '../../audit/enums/audit-action.enum';
import { UsersService } from '../../users/users.service';
import { LoginService } from '../login.service';
import { LoginDto } from '../dto/login.dto';
import { buildUser } from '../../../test/factories/user.factory';
import { buildRequestCtx } from '../../../test/factories/request-context.factory';
import { mockAuditService, mockJwtService } from '../../../test/mocks/repository.mock';
import { Role } from '../../users/enums/role.enum';

jest.mock('bcrypt');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('LoginService', () => {
  let service: LoginService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: ReturnType<typeof mockJwtService>;
  let auditService: ReturnType<typeof mockAuditService>;

  const dto: LoginDto = { email: 'user@test.com', password: 'Secure@1234' };
  const ctx = buildRequestCtx({ userRole: 'SYSTEM' });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoginService,
        {
          provide: UsersService,
          useValue: {
            findByEmailWithPassword: jest.fn(),
          },
        },
        { provide: JwtService, useFactory: mockJwtService },
        { provide: AuditService, useFactory: mockAuditService },
      ],
    }).compile();

    service = module.get(LoginService);
    usersService = module.get(UsersService) as jest.Mocked<UsersService>;
    jwtService = module.get(JwtService);
    auditService = module.get(AuditService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('execute()', () => {
    it('should return an accessToken on valid credentials', async () => {
      const user = buildUser({ email: dto.email, role: Role.USER });
      usersService.findByEmailWithPassword.mockResolvedValue(user);
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(true);
      jwtService.sign.mockReturnValue('valid.jwt.token');

      const result = await service.execute(dto, ctx);

      expect(result).toEqual({ accessToken: 'valid.jwt.token' });
    });

    it('should sign JWT with correct payload (sub, email, role)', async () => {
      const user = buildUser({ email: dto.email, role: Role.ADMIN });
      usersService.findByEmailWithPassword.mockResolvedValue(user);
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(true);

      await service.execute(dto, ctx);

      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: user.id,
        email: user.email,
        role: user.role,
      });
    });

    it('should throw UnauthorizedException when user not found', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue(null);

      await expect(service.execute(dto, ctx)).rejects.toThrow(UnauthorizedException);
      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when password is wrong', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue(buildUser({ email: dto.email }));
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.execute(dto, ctx)).rejects.toThrow(UnauthorizedException);
      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it('should include INVALID_CREDENTIALS error code in exception response', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue(null);

      try {
        await service.execute(dto, ctx);
        fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(UnauthorizedException);
        const response = (err as UnauthorizedException).getResponse() as Record<string, unknown>;
        expect(response.error).toBe('INVALID_CREDENTIALS');
      }
    });

    it('should NOT reveal whether email exists when credentials are wrong (timing safety)', async () => {
      // Same error for unknown email vs wrong password
      usersService.findByEmailWithPassword.mockResolvedValue(null);
      const errorForNoUser = await service.execute(dto, ctx).catch((e) => e);

      usersService.findByEmailWithPassword.mockResolvedValue(buildUser({ email: dto.email }));
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(false);
      const errorForBadPassword = await service.execute(dto, ctx).catch((e) => e);

      // Both throw UnauthorizedException with same error code
      expect(errorForNoUser).toBeInstanceOf(UnauthorizedException);
      expect(errorForBadPassword).toBeInstanceOf(UnauthorizedException);
      const r1 = (errorForNoUser as UnauthorizedException).getResponse() as Record<string, unknown>;
      const r2 = (errorForBadPassword as UnauthorizedException).getResponse() as Record<string, unknown>;
      expect(r1.error).toBe(r2.error);
    });

    it('should log USER_LOGIN with SUCCESS on valid credentials', async () => {
      const user = buildUser({ email: dto.email });
      usersService.findByEmailWithPassword.mockResolvedValue(user);
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(true);

      await service.execute(dto, ctx);
      await new Promise((r) => setImmediate(r));

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.USER_LOGIN,
          entity: 'User',
          entityId: user.id,
          userId: user.id,
          status: 'SUCCESS',
        }),
      );
    });

    it('should log USER_LOGIN_FAILED with FAILURE when user not found', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue(null);

      await expect(service.execute(dto, ctx)).rejects.toThrow();
      await new Promise((r) => setImmediate(r));

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.USER_LOGIN_FAILED,
          status: 'FAILURE',
          failureReason: 'Invalid credentials',
        }),
      );
    });

    it('should log USER_LOGIN_FAILED with FAILURE when password is wrong', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue(buildUser({ email: dto.email }));
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.execute(dto, ctx)).rejects.toThrow();
      await new Promise((r) => setImmediate(r));

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.USER_LOGIN_FAILED,
          status: 'FAILURE',
        }),
      );
    });

    it('should call bcrypt.compare with user.password (hashed), not raw input', async () => {
      const hashed = '$2b$12$realhashedpassword123456789012345';
      const user = buildUser({ email: dto.email, password: hashed });
      usersService.findByEmailWithPassword.mockResolvedValue(user);
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(true);

      await service.execute(dto, ctx);

      expect(mockedBcrypt.compare).toHaveBeenCalledWith(dto.password, hashed);
    });
  });
});
