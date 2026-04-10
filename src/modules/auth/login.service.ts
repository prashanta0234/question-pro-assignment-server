import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/enums/audit-action.enum';
import { UsersService } from '../users/users.service';
import { RequestContext } from '../../common/interfaces/request-context.interface';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class LoginService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
  ) {}

  async execute(dto: LoginDto, requestCtx: RequestContext): Promise<{ accessToken: string }> {
    const user = await this.usersService.findByEmailWithPassword(dto.email);
    const isValid = user !== null && (await bcrypt.compare(dto.password, user.password));

    if (!isValid) {
      void this.auditService.log({
        ...requestCtx,
        userRole: 'SYSTEM',
        action: AuditAction.USER_LOGIN_FAILED,
        entity: 'User',
        status: 'FAILURE',
        failureReason: 'Invalid credentials',
        afterData: { email: dto.email },
      });
      throw new UnauthorizedException({ error: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
    }

    void this.auditService.log({
      ...requestCtx,
      userId: user.id,
      userRole: user.role,
      action: AuditAction.USER_LOGIN,
      entity: 'User',
      entityId: user.id,
      status: 'SUCCESS',
    });

    const accessToken = this.jwtService.sign({ sub: user.id, email: user.email, role: user.role });
    return { accessToken };
  }
}
