import {
  EvaluationContext,
  EvaluationFlag,
  EvaluationReason,
  EvaluationResult,
} from './types';
import { evaluateRule } from './evaluate-rule';

export function evaluateFlag(
  flagKey: string,
  context: EvaluationContext,
  flag: EvaluationFlag | null,
): EvaluationResult {
  if (!flag || flag.key !== flagKey) {
    return {
      enabled: false,
      reason: 'FLAG_NOT_FOUND',
    };
  }

  const config = flag.configs.find(
    (item) => item.environmentKey === context.environment,
  );

  if (!config) {
    return {
      enabled: false,
      reason: 'ENVIRONMENT_NOT_FOUND',
    };
  }

  if (!config.enabled) {
    return {
      enabled: false,
      reason: 'FLAG_DISABLED',
    };
  }

  let lastNoMatchReason: EvaluationReason | null = null;

  for (const rule of config.rules) {
    const result = evaluateRule(rule, context);

    if (result.matched) {
      return {
        enabled: true,
        reason: result.reason,
      };
    }

    lastNoMatchReason = result.reason;
  }

  return {
    enabled: config.defaultValue,
    reason: lastNoMatchReason ?? 'DEFAULT_VALUE',
  };
}
