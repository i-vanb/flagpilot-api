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
import { RuleOperator } from '@prisma/client';

@Injectable()
export class FlagsService {
  constructor(private readonly prisma: PrismaService) {}

  async findByProject(projectId: string) {
    await this.ensureProjectExists(projectId);

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

  async create(projectId: string, dto: CreateFlagDto) {
    await this.ensureProjectExists(projectId);

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

      return tx.featureFlag.findUnique({
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
    });
  }

  async findOne(flagId: string) {
    const flag = await this.prisma.featureFlag.findUnique({
      where: {
        id: flagId,
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

  async update(flagId: string, dto: UpdateFlagDto) {
    await this.ensureFlagExists(flagId);

    return this.prisma.featureFlag.update({
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
  }

  async remove(flagId: string) {
    await this.ensureFlagExists(flagId);

    await this.prisma.featureFlag.delete({
      where: {
        id: flagId,
      },
    });

    return {
      deleted: true,
      id: flagId,
    };
  }

  async findConfigs(flagId: string) {
    await this.ensureFlagExists(flagId);

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
    flagId: string,
    environmentId: string,
    dto: UpdateFlagConfigDto,
  ) {
    const config = await this.prisma.flagEnvironmentConfig.findUnique({
      where: {
        flagId_environmentId: {
          flagId,
          environmentId,
        },
      },
    });

    if (!config) {
      throw new NotFoundException('Flag config for environment not found');
    }

    return this.prisma.flagEnvironmentConfig.update({
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

  async createRule(configId: string, dto: CreateTargetingRuleDto) {
    await this.ensureConfigExists(configId);

    this.validateRule(dto.operator, dto.values ?? [], dto.rolloutPercentage);

    return this.prisma.targetingRule.create({
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
  }

  async updateRule(ruleId: string, dto: UpdateTargetingRuleDto) {
    const existingRule = await this.prisma.targetingRule.findUnique({
      where: {
        id: ruleId,
      },
    });

    if (!existingRule) {
      throw new NotFoundException('Targeting rule not found');
    }

    const nextOperator = dto.operator ?? existingRule.operator;
    const nextValues = dto.values ?? existingRule.values;
    const nextRolloutPercentage =
      dto.rolloutPercentage ?? existingRule.rolloutPercentage;

    this.validateRule(nextOperator, nextValues, nextRolloutPercentage);

    return this.prisma.targetingRule.update({
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
  }

  async removeRule(ruleId: string) {
    const existingRule = await this.prisma.targetingRule.findUnique({
      where: {
        id: ruleId,
      },
      select: {
        id: true,
      },
    });

    if (!existingRule) {
      throw new NotFoundException('Targeting rule not found');
    }

    await this.prisma.targetingRule.delete({
      where: {
        id: ruleId,
      },
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
}
