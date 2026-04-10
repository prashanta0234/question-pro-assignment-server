import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { RolesGuard } from '../roles.guard';
import { Role } from '../../../modules/users/enums/role.enum';
import { ROLES_KEY } from '../../decorators/roles.decorator';
import { JwtPayload } from '../../interfaces/request-with-user.interface';

const buildContext = (user: Partial<JwtPayload>): ExecutionContext =>
  ({
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue({ user }),
    }),
  }) as unknown as ExecutionContext;

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        {
          provide: Reflector,
          useValue: { getAllAndOverride: jest.fn() },
        },
      ],
    }).compile();

    guard = module.get(RolesGuard);
    reflector = module.get(Reflector) as jest.Mocked<Reflector>;
  });

  afterEach(() => jest.clearAllMocks());

  it('should allow access when no @Roles() decorator is set', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const ctx = buildContext({ role: Role.USER });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should allow access when required roles list is empty', () => {
    reflector.getAllAndOverride.mockReturnValue([]);
    const ctx = buildContext({ role: Role.USER });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should allow ADMIN to access ADMIN-only route', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);
    const ctx = buildContext({ role: Role.ADMIN });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should throw ForbiddenException when USER tries to access ADMIN-only route', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);
    const ctx = buildContext({ role: Role.USER });

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should include FORBIDDEN error code in exception response', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);
    const ctx = buildContext({ role: Role.USER });

    try {
      guard.canActivate(ctx);
      fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
      const response = (err as ForbiddenException).getResponse() as Record<string, unknown>;
      expect(response.error).toBe('FORBIDDEN');
    }
  });

  it('should allow access when user role matches one of multiple required roles', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN, Role.USER]);
    const ctx = buildContext({ role: Role.USER });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should check roles using ROLES_KEY metadata key', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);
    const ctx = buildContext({ role: Role.ADMIN });

    guard.canActivate(ctx);

    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, expect.any(Array));
  });
});
