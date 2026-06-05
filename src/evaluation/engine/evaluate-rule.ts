import {
  EvaluationContext,
  EvaluationRule,
  RuleEvaluationResult,
} from './types';
import { isInRollout } from './rollout';

export function evaluateRule(
  rule: EvaluationRule,
  context: EvaluationContext,
): RuleEvaluationResult {
  const contextValue = context[rule.attribute];

  if (contextValue === undefined || contextValue === null) {
    return {
      matched: false,
      reason: 'TARGETING_NO_MATCH',
    };
  }

  const normalizedContextValue = String(contextValue);

  switch (rule.operator) {
    case 'EQUALS': {
      return {
        matched: rule.values[0] === normalizedContextValue,
        reason:
          rule.values[0] === normalizedContextValue
            ? 'TARGETING_MATCH'
            : 'TARGETING_NO_MATCH',
      };
    }

    case 'NOT_EQUALS': {
      return {
        matched: rule.values[0] !== normalizedContextValue,
        reason:
          rule.values[0] !== normalizedContextValue
            ? 'TARGETING_MATCH'
            : 'TARGETING_NO_MATCH',
      };
    }

    case 'IN': {
      const matched = rule.values.includes(normalizedContextValue);

      return {
        matched,
        reason: matched ? 'TARGETING_MATCH' : 'TARGETING_NO_MATCH',
      };
    }

    case 'NOT_IN': {
      const matched = !rule.values.includes(normalizedContextValue);

      return {
        matched,
        reason: matched ? 'TARGETING_MATCH' : 'TARGETING_NO_MATCH',
      };
    }

    case 'PERCENTAGE_ROLLOUT': {
      const percentage = rule.rolloutPercentage ?? 0;
      const matched = isInRollout(normalizedContextValue, percentage);

      return {
        matched,
        reason: matched ? 'ROLLOUT_MATCH' : 'ROLLOUT_NO_MATCH',
      };
    }

    default: {
      return {
        matched: false,
        reason: 'TARGETING_NO_MATCH',
      };
    }
  }
}
