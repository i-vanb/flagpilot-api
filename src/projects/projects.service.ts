import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async findAll(organizationId: string) {
    return this.prisma.project.findMany({
      where: {
        organizationId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        environments: {
          orderBy: {
            key: 'asc',
          },
        },
        _count: {
          select: {
            flags: true,
            apiKeys: true,
          },
        },
      },
    });
  }

  async create(organizationId: string, dto: CreateProjectDto) {
    const organization = await this.prisma.organization.findUnique({
      where: {
        id: organizationId,
      },
      select: {
        id: true,
      },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const existingProject = await this.prisma.project.findUnique({
      where: {
        organizationId_key: {
          organizationId: organizationId,
          key: dto.key,
        },
      },
    });

    if (existingProject) {
      throw new ConflictException(
        `Project with key "${dto.key}" already exists in this organization`,
      );
    }

    const project = await this.prisma.$transaction(async (tx) => {
      const createdProject = await tx.project.create({
        data: {
          organizationId: organizationId,
          name: dto.name,
          key: dto.key,
          description: dto.description,
        },
      });

      await tx.environment.createMany({
        data: [
          {
            projectId: createdProject.id,
            name: 'Development',
            key: 'development',
          },
          {
            projectId: createdProject.id,
            name: 'Staging',
            key: 'staging',
          },
          {
            projectId: createdProject.id,
            name: 'Production',
            key: 'production',
          },
        ],
      });

      return tx.project.findUnique({
        where: {
          id: createdProject.id,
        },
        include: {
          environments: {
            orderBy: {
              key: 'asc',
            },
          },
        },
      });
    });

    if (!project) {
      throw new NotFoundException('Created project not found');
    }

    await this.auditLogs.create({
      organizationId: organizationId,
      projectId: project.id,
      action: AuditAction.CREATE,
      entityType: 'Project',
      entityId: project.id,
      before: null,
      after: project,
    });

    return project;
  }

  async findOne(organizationId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        environments: {
          orderBy: {
            key: 'asc',
          },
        },
        flags: {
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            id: true,
            key: true,
            name: true,
            description: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        apiKeys: {
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            id: true,
            name: true,
            prefix: true,
            revokedAt: true,
            lastUsedAt: true,
            createdAt: true,
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  async update(
    organizationId: string,
    projectId: string,
    dto: UpdateProjectDto,
  ) {
    const existingProject = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId,
      },
    });

    if (!existingProject) {
      throw new NotFoundException('Project not found');
    }

    const updatedProject = await this.prisma.project.update({
      where: {
        id: projectId,
      },
      data: {
        name: dto.name,
        description: dto.description,
      },
    });

    await this.auditLogs.create({
      organizationId,
      projectId,
      action: AuditAction.UPDATE,
      entityType: 'Project',
      entityId: projectId,
      before: existingProject,
      after: updatedProject,
    });

    return updatedProject;
  }

  async remove(organizationId: string, projectId: string) {
    const existingProject = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId,
      },
    });

    if (!existingProject) {
      throw new NotFoundException('Project not found');
    }

    await this.prisma.project.delete({
      where: {
        id: projectId,
      },
    });

    await this.auditLogs.create({
      organizationId,
      projectId: null,
      action: AuditAction.DELETE,
      entityType: 'Project',
      entityId: projectId,
      before: existingProject,
      after: null,
    });

    return {
      deleted: true,
      id: projectId,
    };
  }
}
