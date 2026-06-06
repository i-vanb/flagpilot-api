import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEnvironmentDto } from './dto/create-environment.dto';
import { UpdateEnvironmentDto } from './dto/update-environment.dto';

@Injectable()
export class EnvironmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async findByProject(projectId: string) {
    await this.ensureProjectExists(projectId);

    return this.prisma.environment.findMany({
      where: {
        projectId,
      },
      orderBy: {
        key: 'asc',
      },
      include: {
        _count: {
          select: {
            flagConfigs: true,
            apiKeys: true,
          },
        },
      },
    });
  }

  async create(projectId: string, dto: CreateEnvironmentDto) {
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

    const existingEnvironment = await this.prisma.environment.findUnique({
      where: {
        projectId_key: {
          projectId,
          key: dto.key,
        },
      },
    });

    if (existingEnvironment) {
      throw new ConflictException(
        `Environment with key "${dto.key}" already exists in this project`,
      );
    }

    const flags = await this.prisma.featureFlag.findMany({
      where: {
        projectId,
      },
      select: {
        id: true,
      },
    });

    const environment = await this.prisma.$transaction(async (tx) => {
      const createdEnvironment = await tx.environment.create({
        data: {
          projectId,
          name: dto.name,
          key: dto.key,
        },
      });

      if (flags.length > 0) {
        await tx.flagEnvironmentConfig.createMany({
          data: flags.map((flag) => ({
            flagId: flag.id,
            environmentId: createdEnvironment.id,
            enabled: false,
            defaultValue: false,
          })),
        });
      }

      return tx.environment.findUnique({
        where: {
          id: createdEnvironment.id,
        },
        include: {
          flagConfigs: true,
        },
      });
    });

    if (!environment) {
      throw new NotFoundException('Created environment not found');
    }

    await this.auditLogs.create({
      organizationId: project.organizationId,
      projectId,
      action: AuditAction.CREATE,
      entityType: 'Environment',
      entityId: environment.id,
      before: null,
      after: environment,
    });

    return environment;
  }

  async update(environmentId: string, dto: UpdateEnvironmentDto) {
    const existingEnvironment = await this.prisma.environment.findUnique({
      where: {
        id: environmentId,
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

    if (!existingEnvironment) {
      throw new NotFoundException('Environment not found');
    }

    const updatedEnvironment = await this.prisma.environment.update({
      where: {
        id: environmentId,
      },
      data: {
        name: dto.name,
      },
    });

    await this.auditLogs.create({
      organizationId: existingEnvironment.project.organizationId,
      projectId: existingEnvironment.project.id,
      action: AuditAction.UPDATE,
      entityType: 'Environment',
      entityId: environmentId,
      before: existingEnvironment,
      after: updatedEnvironment,
    });

    return updatedEnvironment;
  }

  async remove(environmentId: string) {
    const existingEnvironment = await this.prisma.environment.findUnique({
      where: {
        id: environmentId,
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

    if (!existingEnvironment) {
      throw new NotFoundException('Environment not found');
    }

    if (
      ['production', 'staging', 'development'].includes(existingEnvironment.key)
    ) {
      throw new ConflictException('Default environments cannot be deleted');
    }

    await this.prisma.environment.delete({
      where: {
        id: environmentId,
      },
    });

    await this.auditLogs.create({
      organizationId: existingEnvironment.project.organizationId,
      projectId: existingEnvironment.project.id,
      action: AuditAction.DELETE,
      entityType: 'Environment',
      entityId: environmentId,
      before: existingEnvironment,
      after: null,
    });

    return {
      deleted: true,
      id: environmentId,
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
