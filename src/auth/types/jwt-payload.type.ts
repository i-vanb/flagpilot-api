import { UserRole } from '@prisma/client';

export type JwtPayload = {
  sub: string;
  email: string;
  organizationId: string;
  role: UserRole;
};
