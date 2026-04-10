import { Request } from 'express';
import { Role } from '../../modules/users/enums/role.enum';

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  iat?: number;
  exp?: number;
}

export interface RequestWithUser extends Request {
  user: JwtPayload;
  id: string;
}

export interface RequestWithId extends Request {
  id: string;
}
