import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthGuard } from '@nestjs/passport';
import { JwtAuthGuard } from '../jwt-auth.guard';
import { IS_PUBLIC_KEY } from '../../decorators/public.decorator';

const buildContext = (isPublic: boolean | undefined = undefined): ExecutionContext =>
  ({
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue({}),
    }),
  }) as unknown as ExecutionContext;

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get(JwtAuthGuard);
    reflector = module.get(Reflector) as jest.Mocked<Reflector>;
  });

  afterEach(() => jest.clearAllMocks());

  it('should return true immediately for routes decorated with @Public()', () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const ctx = buildContext(true);

    const result = guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, expect.any(Array));
  });

  it('should call super.canActivate (passport JWT validation) for protected routes', () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const superSpy = jest
      .spyOn(AuthGuard('jwt').prototype, 'canActivate')
      .mockReturnValue(false);

    const ctx = buildContext(false);
    guard.canActivate(ctx);

    expect(superSpy).toHaveBeenCalledWith(ctx);
    superSpy.mockRestore();
  });

  it('should call super.canActivate when @Public() is not set (undefined)', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const superSpy = jest
      .spyOn(AuthGuard('jwt').prototype, 'canActivate')
      .mockReturnValue(true);

    const ctx = buildContext();
    guard.canActivate(ctx);

    expect(superSpy).toHaveBeenCalledWith(ctx);
    superSpy.mockRestore();
  });
});
