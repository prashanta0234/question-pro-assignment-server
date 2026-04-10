import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { extractRequestCtx } from '../../common/helpers/request-context.helper';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginService } from './login.service';
import { RegisterService } from './register.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerService: RegisterService,
    private readonly loginService: LoginService,
  ) {}

  @Public()
  @Post('register')
  @Throttle({ register: { ttl: 60_000, limit: 5 } })  // 5 req/min per IP
  @ApiOperation({ summary: 'Create a new user account' })
  @ApiResponse({ status: 201, description: 'Registered successfully', type: AuthResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error — invalid fields or extra properties' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  @ApiResponse({ status: 429, description: 'Too many registration attempts — try again later' })
  register(@Body() dto: RegisterDto, @Req() req: Request & { id?: string }): Promise<AuthResponseDto> {
    return this.registerService.execute(dto, extractRequestCtx(req));
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ login: { ttl: 60_000, limit: 10 } })  // 10 req/min per IP
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Authenticate and receive a JWT access token' })
  @ApiResponse({ status: 200, description: 'Login successful', type: AuthResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error — invalid email format' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 429, description: 'Too many login attempts — try again later' })
  login(@Body() dto: LoginDto, @Req() req: Request & { id?: string }): Promise<AuthResponseDto> {
    return this.loginService.execute(dto, extractRequestCtx(req));
  }
}
