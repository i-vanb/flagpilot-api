import { evaluateRule } from './evaluate-rule';
import { EvaluationContext, EvaluationRule } from './types';

describe('evaluateRule', () => {
  const context: EvaluationContext = {
    environment: 'production',
    userId: 'sam',
    role: 'admin',
    country: 'GE',
    accountId: 'account-123',
  };

  it('returns TARGETING_NO_MATCH when context attribute is missing', () => {
    const rule: EvaluationRule = {
      attribute: 'missingAttribute',
      operator: 'EQUALS',
      values: ['value'],
    };

    const result = evaluateRule(rule, context);

    expect(result).toEqual({
      matched: false,
      reason: 'TARGETING_NO_MATCH',
    });
  });

  it('matches EQUALS rule', () => {
    const rule: EvaluationRule = {
      attribute: 'role',
      operator: 'EQUALS',
      values: ['admin'],
    };

    const result = evaluateRule(rule, context);

    expect(result).toEqual({
      matched: true,
      reason: 'TARGETING_MATCH',
    });
  });

  it('does not match EQUALS rule when value is different', () => {
    const rule: EvaluationRule = {
      attribute: 'role',
      operator: 'EQUALS',
      values: ['user'],
    };

    const result = evaluateRule(rule, context);

    expect(result).toEqual({
      matched: false,
      reason: 'TARGETING_NO_MATCH',
    });
  });

  it('matches NOT_EQUALS rule', () => {
    const rule: EvaluationRule = {
      attribute: 'role',
      operator: 'NOT_EQUALS',
      values: ['user'],
    };

    const result = evaluateRule(rule, context);

    expect(result).toEqual({
      matched: true,
      reason: 'TARGETING_MATCH',
    });
  });

  it('does not match NOT_EQUALS rule when value is equal', () => {
    const rule: EvaluationRule = {
      attribute: 'role',
      operator: 'NOT_EQUALS',
      values: ['admin'],
    };

    const result = evaluateRule(rule, context);

    expect(result).toEqual({
      matched: false,
      reason: 'TARGETING_NO_MATCH',
    });
  });

  it('matches IN rule', () => {
    const rule: EvaluationRule = {
      attribute: 'userId',
      operator: 'IN',
      values: ['sam', 'alex'],
    };

    const result = evaluateRule(rule, context);

    expect(result).toEqual({
      matched: true,
      reason: 'TARGETING_MATCH',
    });
  });

  it('does not match IN rule when value is not included', () => {
    const rule: EvaluationRule = {
      attribute: 'userId',
      operator: 'IN',
      values: ['charlie'],
    };

    const result = evaluateRule(rule, context);

    expect(result).toEqual({
      matched: false,
      reason: 'TARGETING_NO_MATCH',
    });
  });

  it('matches NOT_IN rule', () => {
    const rule: EvaluationRule = {
      attribute: 'country',
      operator: 'NOT_IN',
      values: ['US', 'DE'],
    };

    const result = evaluateRule(rule, context);

    expect(result).toEqual({
      matched: true,
      reason: 'TARGETING_MATCH',
    });
  });

  it('does not match NOT_IN rule when value is included', () => {
    const rule: EvaluationRule = {
      attribute: 'country',
      operator: 'NOT_IN',
      values: ['GE', 'US'],
    };

    const result = evaluateRule(rule, context);

    expect(result).toEqual({
      matched: false,
      reason: 'TARGETING_NO_MATCH',
    });
  });

  it('matches PERCENTAGE_ROLLOUT when rollout percentage is 100', () => {
    const rule: EvaluationRule = {
      attribute: 'userId',
      operator: 'PERCENTAGE_ROLLOUT',
      values: [],
      rolloutPercentage: 100,
    };

    const result = evaluateRule(rule, context);

    expect(result).toEqual({
      matched: true,
      reason: 'ROLLOUT_MATCH',
    });
  });

  it('does not match PERCENTAGE_ROLLOUT when rollout percentage is 0', () => {
    const rule: EvaluationRule = {
      attribute: 'userId',
      operator: 'PERCENTAGE_ROLLOUT',
      values: [],
      rolloutPercentage: 0,
    };

    const result = evaluateRule(rule, context);

    expect(result).toEqual({
      matched: false,
      reason: 'ROLLOUT_NO_MATCH',
    });
  });

  it('uses 0 as fallback rollout percentage when rolloutPercentage is missing', () => {
    const rule: EvaluationRule = {
      attribute: 'userId',
      operator: 'PERCENTAGE_ROLLOUT',
      values: [],
    };

    const result = evaluateRule(rule, context);

    expect(result).toEqual({
      matched: false,
      reason: 'ROLLOUT_NO_MATCH',
    });
  });
});
