import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { evaluateFlag } from '../evaluation/engine/evaluate-flag';
import { EvaluationContext, EvaluationFlag } from '../evaluation/engine/types';

type EvaluateFlagParams = {
  flagKey: string;
  context: EvaluationContext;
};

@Injectable()
export class SdkService {
  constructor(private readonly prisma: PrismaService) {}

  async evaluateFlag(params: EvaluateFlagParams) {
    const { flagKey, context } = params;

    const environmentKey = context.environment;

    const flag = await this.prisma.featureFlag.findFirst({
      where: {
        key: flagKey,
        configs: {
          some: {
            environment: {
              key: environmentKey,
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
}
