import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { evaluateFlag } from '../evaluation/engine/evaluate-flag';
import { EvaluationContext, EvaluationFlag } from '../evaluation/engine/types';

type EvaluateFlagParams = {
  flagKey: string;
  context: EvaluationContext;
  projectId: string;
  environmentId?: string | null;
};

type EvaluateFlagsBatchParams = {
  flagKeys: string[];
  context: EvaluationContext;
  projectId: string;
  environmentId?: string | null;
};

@Injectable()
export class SdkService {
  constructor(private readonly prisma: PrismaService) {}

  async evaluateFlag(params: EvaluateFlagParams) {
    const { flagKey, context, projectId, environmentId } = params;

    const environmentKey = context.environment;

    const flag = await this.prisma.featureFlag.findFirst({
      where: {
        key: flagKey,
        projectId,
        configs: {
          some: {
            environment: {
              key: environmentKey,
              ...(environmentId ? { id: environmentId } : {}),
            },
          },
        },
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

    const evaluationFlag: EvaluationFlag | null = flag
      ? {
          key: flag.key,
          configs: flag.configs.map((config) => ({
            environmentKey: config.environment.key,
            enabled: config.enabled,
            defaultValue: config.defaultValue,
            rules: config.rules.map((rule) => ({
              attribute: rule.attribute,
              operator: rule.operator,
              values: rule.values,
              rolloutPercentage: rule.rolloutPercentage,
            })),
          })),
        }
      : null;

    const result = evaluateFlag(flagKey, context, evaluationFlag);

    return {
      flagKey,
      enabled: result.enabled,
      reason: result.reason,
    };
  }

  async evaluateFlagsBatch(params: EvaluateFlagsBatchParams) {
    const { flagKeys, context, projectId, environmentId } = params;

    const environmentKey = context.environment;

    const uniqueFlagKeys = [...new Set(flagKeys)];

    const flags = await this.prisma.featureFlag.findMany({
      where: {
        key: {
          in: uniqueFlagKeys,
        },
        projectId,
        configs: {
          some: {
            environment: {
              key: environmentKey,
              ...(environmentId ? { id: environmentId } : {}),
            },
          },
        },
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

    const flagsByKey = new Map(
      flags.map((flag) => {
        const evaluationFlag: EvaluationFlag = {
          key: flag.key,
          configs: flag.configs.map((config) => ({
            environmentKey: config.environment.key,
            enabled: config.enabled,
            defaultValue: config.defaultValue,
            rules: config.rules.map((rule) => ({
              attribute: rule.attribute,
              operator: rule.operator,
              values: rule.values,
              rolloutPercentage: rule.rolloutPercentage,
            })),
          })),
        };

        return [flag.key, evaluationFlag];
      }),
    );

    const result: Record<
      string,
      {
        enabled: boolean;
        reason: string;
      }
    > = {};

    for (const flagKey of uniqueFlagKeys) {
      const evaluationResult = evaluateFlag(
        flagKey,
        context,
        flagsByKey.get(flagKey) ?? null,
      );

      result[flagKey] = {
        enabled: evaluationResult.enabled,
        reason: evaluationResult.reason,
      };
    }

    return {
      flags: result,
    };
  }
}
