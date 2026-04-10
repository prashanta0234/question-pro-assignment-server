import { randomUUID } from 'crypto';
import { User } from '../../modules/users/entities/user.entity';
import { Role } from '../../modules/users/enums/role.enum';

export const buildUser = (overrides: Partial<User> = {}): User => {
  const user = new User();
  Object.assign(user, {
    id: randomUUID(),
    email: `user-${Date.now()}@test.com`,
    password: '$2b$12$hashedpasswordhashedpasswordhashed',
    role: Role.USER,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  });
  return user;
};

export const buildAdmin = (overrides: Partial<User> = {}): User =>
  buildUser({ role: Role.ADMIN, ...overrides });
