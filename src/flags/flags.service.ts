import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFlagDto } from './dto/create-flag.dto';
import { UpdateFlagDto } from './dto/update-flag.dto';
import { UpdateFlagConfigDto } from './dto/update-flag-config.dto';
import { CreateTargetingRuleDto } from './dto/create-targeting-rule.dto';
import { UpdateTargetingRuleDto } from './dto/update-targeting-rule.dto';
import { AuditAction, RuleOperator } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { toPrismaJson } from '../common/utils/to-prisma-json';

@Injectable()
export class FlagsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async findByProject(organizationId: string, projectId: string) {
    await this.ensureProjectBelongsToOrganization(organizationId, projectId);

    return this.prisma.featureFlag.findMany({
      where: {
        projectId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        configs: {
          include: {
            environment: true,
            rules: true,
          },
          orderBy: {
            environment: {
              key: 'asc',
            },
          },
        },
      },
    });
  }

  async create(organizationId: string, projectId: string, dto: CreateFlagDto) {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId,
      },
      select: {
        id: true,
        organizationId: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const existingFlag = await this.prisma.featureFlag.findUnique({
      where: {
        projectId_key: {
          projectId,
          key: dto.key,
        },
      },
    });

    if (existingFlag) {
      throw new ConflictException(
        `Feature flag with key "${dto.key}" already exists in this project`,
      );
    }

    const environments = await this.prisma.environment.findMany({
      where: {
        projectId,
      },
    });

    return this.prisma.$transaction(async (tx) => {
      const flag = await tx.featureFlag.create({
        data: {
          projectId,
          key: dto.key,
          name: dto.name,
          description: dto.description,
        },
      });

      if (environments.length > 0) {
        await tx.flagEnvironmentConfig.createMany({
          data: environments.map((environment) => ({
            flagId: flag.id,
            environmentId: environment.id,
            enabled: false,
            defaultValue: false,
          })),
        });
      }

      const createdFlag = await tx.featureFlag.findUnique({
        where: {
          id: flag.id,
        },
        include: {
          configs: {
            include: {
              environment: true,
              rules: true,
            },
          },
        },
      });

      if (!createdFlag) {
        throw new NotFoundException('Created feature flag not found');
      }

      await tx.auditLog.create({
        data: {
          organizationId: project.organizationId,
          projectId,
          flagId: flag.id,
          action: AuditAction.CREATE,
          entityType: 'FeatureFlag',
          entityId: flag.id,
          before: undefined,
          after: toPrismaJson(createdFlag),
        },
      });

      return createdFlag;
    });
  }

  async findOne(organizationId: string, flagId: string) {
    const flag = await this.prisma.featureFlag.findFirst({
      where: {
        id: flagId,
        project: {
          organizationId,
        },
      },
      include: {
        project: true,
        configs: {
          include: {
            environment: true,
            rules: true,
          },
          orderBy: {
            environment: {
              key: 'asc',
            },
          },
        },
      },
    });

    if (!flag) {
      throw new NotFoundException('Feature flag not found');
    }

    return flag;
  }

  async update(organizationId: string, flagId: string, dto: UpdateFlagDto) {
    const { flag, projectId } = await this.getFlagAuditContext(
      organizationId,
      flagId,
    );

    const updatedFlag = await this.prisma.featureFlag.update({
      where: {
        id: flagId,
      },
      data: {
        name: dto.name,
        description: dto.description,
      },
      include: {
        configs: {
          include: {
            environment: true,
            rules: true,
          },
        },
      },
    });

    await this.auditLogs.create({
      organizationId,
      projectId,
      flagId,
      action: AuditAction.UPDATE,
      entityType: 'FeatureFlag',
      entityId: flagId,
      before: flag,
      after: updatedFlag,
    });

    return updatedFlag;
  }

  async remove(organizationId: string, flagId: string) {
    const { flag, projectId } = await this.getFlagAuditContext(
      organizationId,
      flagId,
    );

    await this.prisma.featureFlag.delete({
      where: {
        id: flagId,
      },
    });

    await this.auditLogs.create({
      organizationId,
      projectId,
      flagId: null,
      action: AuditAction.DELETE,
      entityType: 'FeatureFlag',
      entityId: flagId,
      before: flag,
      after: null,
    });

    return {
      deleted: true,
      id: flagId,
    };
  }

  async findConfigs(organizationId: string, flagId: string) {
    await this.getFlagAuditContext(organizationId, flagId);

    return this.prisma.flagEnvironmentConfig.findMany({
      where: {
        flagId,
      },
      include: {
        environment: true,
        rules: true,
      },
      orderBy: {
        environment: {
          key: 'asc',
        },
      },
    });
  }

  async updateConfig(
    organizationId: string,
    flagId: string,
    environmentId: string,
    dto: UpdateFlagConfigDto,
  ) {
    const config = await this.prisma.flagEnvironmentConfig.findFirst({
      where: {
        flagId,
        environmentId,
        flag: {
          project: {
            organizationId,
          },
        },
      },
      include: {
        flag: {
          include: {
            project: {
              select: {
                id: true,
                organizationId: true,
              },
            },
          },
        },
      },
    });

    if (!config) {
      throw new NotFoundException('Flag config for environment not found');
    }

    const updatedConfig = await this.prisma.flagEnvironmentConfig.update({
      where: {
        flagId_environmentId: {
          flagId,
          environmentId,
        },
      },
      data: {
        enabled: dto.enabled,
        defaultValue: dto.defaultValue,
      },
      include: {
        environment: true,
        rules: true,
      },
    });

    await this.auditLogs.create({
      organizationId,
      projectId: config.flag.project.id,
      flagId,
      action: AuditAction.UPDATE,
      entityType: 'FlagEnvironmentConfig',
      entityId: config.id,
      before: config,
      after: updatedConfig,
    });

    return updatedConfig;
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

  private async ensureFlagExists(flagId: string): Promise<void> {
    const flag = await this.prisma.featureFlag.findUnique({
      where: {
        id: flagId,
      },
      select: {
        id: true,
      },
    });

    if (!flag) {
      throw new NotFoundException('Feature flag not found');
    }
  }

  async createRule(
    organizationId: string,
    configId: string,
    dto: CreateTargetingRuleDto,
  ) {
    const context = await this.getConfigAuditContext(organizationId, configId);

    this.validateRule(dto.operator, dto.values ?? [], dto.rolloutPercentage);

    const rule = await this.prisma.targetingRule.create({
      data: {
        configId,
        attribute: dto.attribute,
        operator: dto.operator,
        values:
          dto.operator === RuleOperator.PERCENTAGE_ROLLOUT ? [] : dto.values,
        rolloutPercentage:
          dto.operator === RuleOperator.PERCENTAGE_ROLLOUT
            ? dto.rolloutPercentage
            : null,
      },
    });

    await this.auditLogs.create({
      organizationId: context.organizationId,
      projectId: context.projectId,
      flagId: context.flag.id,
      action: AuditAction.CREATE,
      entityType: 'TargetingRule',
      entityId: rule.id,
      before: null,
      after: rule,
    });

    return rule;
  }

  async updateRule(
    organizationId: string,
    ruleId: string,
    dto: UpdateTargetingRuleDto,
  ) {
    const context = await this.getRuleAuditContext(organizationId, ruleId);
    const existingRule = context.rule;

    if (!existingRule) {
      throw new NotFoundException('Targeting rule not found');
    }

    const nextOperator = dto.operator ?? existingRule.operator;
    const nextValues = dto.values ?? existingRule.values;
    const nextRolloutPercentage =
      dto.rolloutPercentage ?? existingRule.rolloutPercentage;

    this.validateRule(nextOperator, nextValues, nextRolloutPercentage);

    const updatedRule = await this.prisma.targetingRule.update({
      where: {
        id: ruleId,
      },
      data: {
        attribute: dto.attribute,
        operator: dto.operator,
        values:
          nextOperator === RuleOperator.PERCENTAGE_ROLLOUT ? [] : nextValues,
        rolloutPercentage:
          nextOperator === RuleOperator.PERCENTAGE_ROLLOUT
            ? nextRolloutPercentage
            : null,
      },
    });

    await this.auditLogs.create({
      organizationId: context.organizationId,
      projectId: context.projectId,
      flagId: context.flag.id,
      action: AuditAction.UPDATE,
      entityType: 'TargetingRule',
      entityId: ruleId,
      before: existingRule,
      after: updatedRule,
    });

    return updatedRule;
  }

  async removeRule(organizationId: string, ruleId: string) {
    const context = await this.getRuleAuditContext(organizationId, ruleId);

    await this.prisma.targetingRule.delete({
      where: {
        id: ruleId,
      },
    });

    await this.auditLogs.create({
      organizationId: context.organizationId,
      projectId: context.projectId,
      flagId: context.flag.id,
      action: AuditAction.DELETE,
      entityType: 'TargetingRule',
      entityId: ruleId,
      before: context.rule,
      after: null,
    });

    return {
      deleted: true,
      id: ruleId,
    };
  }

  private async ensureConfigExists(configId: string): Promise<void> {
    const config = await this.prisma.flagEnvironmentConfig.findUnique({
      where: {
        id: configId,
      },
      select: {
        id: true,
      },
    });

    if (!config) {
      throw new NotFoundException('Flag config not found');
    }
  }

  private validateRule(
    operator: RuleOperator,
    values: string[],
    rolloutPercentage?: number | null,
  ): void {
    if (operator === RuleOperator.PERCENTAGE_ROLLOUT) {
      if (
        rolloutPercentage === undefined ||
        rolloutPercentage === null ||
        rolloutPercentage < 0 ||
        rolloutPercentage > 100
      ) {
        throw new ConflictException(
          'PERCENTAGE_ROLLOUT rule requires rolloutPercentage between 0 and 100',
        );
      }

      return;
    }

    if (!values || values.length === 0) {
      throw new ConflictException(
        `${operator} rule requires at least one value`,
      );
    }
  }

  private async getFlagAuditContext(organizationId: string, flagId: string) {
    const flag = await this.prisma.featureFlag.findFirst({
      where: {
        id: flagId,
        project: {
          organizationId,
        },
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

    if (!flag) {
      throw new NotFoundException('Feature flag not found');
    }

    return {
      flag,
      projectId: flag.project.id,
      organizationId: flag.project.organizationId,
    };
  }

  private async getConfigAuditContext(
    organizationId: string,
    configId: string,
  ) {
    const config = await this.prisma.flagEnvironmentConfig.findFirst({
      where: {
        id: configId,
        flag: {
          project: {
            organizationId,
          },
        },
      },
      include: {
        flag: {
          include: {
            project: {
              select: {
                id: true,
                organizationId: true,
              },
            },
          },
        },
      },
    });

    if (!config) {
      throw new NotFoundException('Flag config not found');
    }

    return {
      config,
      flag: config.flag,
      projectId: config.flag.project.id,
      organizationId: config.flag.project.organizationId,
    };
  }

  private async getRuleAuditContext(organizationId: string, ruleId: string) {
    const rule = await this.prisma.targetingRule.findFirst({
      where: {
        id: ruleId,
        config: {
          flag: {
            project: {
              organizationId,
            },
          },
        },
      },
      include: {
        config: {
          include: {
            flag: {
              include: {
                project: {
                  select: {
                    id: true,
                    organizationId: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!rule) {
      throw new NotFoundException('Targeting rule not found');
    }

    return {
      rule,
      config: rule.config,
      flag: rule.config.flag,
      projectId: rule.config.flag.project.id,
      organizationId: rule.config.flag.project.organizationId,
    };
  }

  private async ensureProjectBelongsToOrganization(
    organizationId: string,
    projectId: string,
  ): Promise<void> {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId,
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
