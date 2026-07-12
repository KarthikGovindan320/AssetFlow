import type { Role } from '@prisma/client';

export interface Actor {
  id: string;
  role: Role;
  departmentId: string | null;
  name: string;
}
