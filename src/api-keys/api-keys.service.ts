import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { ApiKeyHasherService } from './api-key-hasher.service';

@Injectable()
export class ApiKeysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly apiKeyHasher: ApiKeyHasherService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async findByProject(projectId: string) {
    await this.ensureProjectExists(projectId);

    return this.prisma.apiKey.findMany({
      where: {
        projectId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        name: true,
        prefix: true,
        projectId: true,
        environmentId: true,
        revokedAt: true,
        lastUsedAt: true,
        createdAt: true,
        updatedAt: true,
        environment: {
          select: {
            id: true,
            key: true,
            name: true,
          },
        },
      },
    });
  }

  async create(projectId: string, dto: CreateApiKeyDto) {
    const project = await this.prisma.project.findUnique({
      where: {
        id: projectId,
      },
      select: {
        id: true,
        organizationId: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (dto.environmentId) {
      const environment = await this.prisma.environment.findFirst({
        where: {
          id: dto.environmentId,
          projectId,
        },
        select: {
          id: true,
        },
      });

      if (!environment) {
        throw new ConflictException(
          'Environment does not belong to this project',
        );
      }
    }

    const rawKey = this.apiKeyHasher.generateRawKey();
    const keyHash = this.apiKeyHasher.hash(rawKey);
    const prefix = this.apiKeyHasher.getPrefix(rawKey);

    const apiKey = await this.prisma.apiKey.create({
      data: {
        name: dto.name,
        keyHash,
        prefix,
        organizationId: project.organizationId,
        projectId,
        environmentId: dto.environmentId ?? null,
      },
      select: {
        id: true,
        name: true,
        prefix: true,
        projectId: true,
        environmentId: true,
        revokedAt: true,
        lastUsedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.auditLogs.create({
      organizationId: project.organizationId,
      projectId,
      action: AuditAction.CREATE,
      entityType: 'ApiKey',
      entityId: apiKey.id,
      before: null,
      after: apiKey,
    });

    return {
      apiKey,
      rawKey,
    };
  }

  async rotate(apiKeyId: string) {
    const existingApiKey = await this.prisma.apiKey.findUnique({
      where: {
        id: apiKeyId,
      },
      include: {
        project: {
          select: {
            id: true,
            organizationId: true,
          },
        },
      },
    });

    if (!existingApiKey) {
      throw new NotFoundException('API key not found');
    }

    if (existingApiKey.revokedAt) {
      throw new ConflictException('Cannot rotate revoked API key');
    }

    const rawKey = this.apiKeyHasher.generateRawKey();
    const keyHash = this.apiKeyHasher.hash(rawKey);
    const prefix = this.apiKeyHasher.getPrefix(rawKey);

    const updatedApiKey = await this.prisma.apiKey.update({
      where: {
        id: apiKeyId,
      },
      data: {
        keyHash,
        prefix,
        lastUsedAt: null,
      },
      select: {
        id: true,
        name: true,
        prefix: true,
        projectId: true,
        environmentId: true,
        revokedAt: true,
        lastUsedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.auditLogs.create({
      organizationId: existingApiKey.project.organizationId,
      projectId: existingApiKey.project.id,
      action: AuditAction.ROTATE_API_KEY,
      entityType: 'ApiKey',
      entityId: apiKeyId,
      before: {
        id: existingApiKey.id,
        name: existingApiKey.name,
        prefix: existingApiKey.prefix,
        projectId: existingApiKey.projectId,
        environmentId: existingApiKey.environmentId,
        revokedAt: existingApiKey.revokedAt,
        lastUsedAt: existingApiKey.lastUsedAt,
      },
      after: updatedApiKey,
    });

    return {
      apiKey: updatedApiKey,
      rawKey,
    };
  }

  async revoke(apiKeyId: string) {
    const existingApiKey = await this.prisma.apiKey.findUnique({
      where: {
        id: apiKeyId,
      },
      include: {
        project: {
          select: {
            id: true,
            organizationId: true,
          },
        },
      },
    });

    if (!existingApiKey) {
      throw new NotFoundException('API key not found');
    }

    if (existingApiKey.revokedAt) {
      return {
        revoked: true,
        id: apiKeyId,
      };
    }

    const revokedApiKey = await this.prisma.apiKey.update({
      where: {
        id: apiKeyId,
      },
      data: {
        revokedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        prefix: true,
        projectId: true,
        environmentId: true,
        revokedAt: true,
        lastUsedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.auditLogs.create({
      organizationId: existingApiKey.project.organizationId,
      projectId: existingApiKey.project.id,
      action: AuditAction.DELETE,
      entityType: 'ApiKey',
      entityId: apiKeyId,
      before: {
        id: existingApiKey.id,
        name: existingApiKey.name,
        prefix: existingApiKey.prefix,
        projectId: existingApiKey.projectId,
        environmentId: existingApiKey.environmentId,
        revokedAt: existingApiKey.revokedAt,
        lastUsedAt: existingApiKey.lastUsedAt,
      },
      after: revokedApiKey,
    });

    return {
      revoked: true,
      id: apiKeyId,
    };
  }

  private async ensureProjectExists(projectId: string): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: {
        id: projectId,
      },
      select: {
        id: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }
  }
}
