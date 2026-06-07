import { Injectable } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toPrismaJson } from '../common/utils/to-prisma-json';

type CreateAuditLogParams = {
  organizationId: string;
  projectId?: string | null;
  userId?: string | null;
  flagId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
};

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(params: CreateAuditLogParams) {
    return this.prisma.auditLog.create({
      data: {
        organizationId: params.organizationId,
        projectId: params.projectId ?? null,
        userId: params.userId ?? null,
        flagId: params.flagId ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        before:
          params.before === undefined ? undefined : toPrismaJson(params.before),
        after:
          params.after === undefined ? undefined : toPrismaJson(params.after),
      },
    });
  }

  async findByProject(projectId: string) {
    return this.prisma.auditLog.findMany({
      where: {
        projectId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        flag: {
          select: {
            id: true,
            key: true,
            name: true,
          },
        },
      },
    });
  }

  async findByFlag(flagId: string) {
    return this.prisma.auditLog.findMany({
      where: {
        flagId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });
  }
}
