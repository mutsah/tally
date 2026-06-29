import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEYS = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEYS, roles);
