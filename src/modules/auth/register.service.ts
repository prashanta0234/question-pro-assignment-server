import { ConflictException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/enums/audit-action.enum';
import { UsersService } from '../users/users.service';
import { RequestContext } from '../../common/interfaces/request-context.interface';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class RegisterService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
  ) {}

  async execute(dto: RegisterDto, requestCtx: RequestContext): Promise<{ accessToken: string }> {
    const existing = await this.usersService.findByEmail(dto.email);

    if (existing) {
      void this.auditService.log({
        ...requestCtx,
        userRole: 'SYSTEM',
        action: AuditAction.USER_REGISTERED,
        entity: 'User',
        status: 'FAILURE',
        failureReason: 'Email already exists',
        afterData: { email: dto.email },
      });
      throw new ConflictException({ error: 'CONFLICT', message: 'Email already registered' });
    }

    const user = await this.usersService.create({ email: dto.email, password: dto.password });

    void this.auditService.log({
      ...requestCtx,
      userRole: 'SYSTEM',
      action: AuditAction.USER_REGISTERED,
      entity: 'User',
      entityId: user.id,
      status: 'SUCCESS',
      afterData: { id: user.id, email: user.email, role: user.role },
    });

    const accessToken = this.jwtService.sign({ sub: user.id, email: user.email, role: user.role });
    return { accessToken };
  }
}
