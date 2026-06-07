import { evaluateFlag } from '../evaluate-flag';
import { EvaluationFlag } from '../types';

describe('evaluateFlag', () => {
  it('returns false when flag does not exist', () => {
    const result = evaluateFlag(
      'missing-flag',
      {
        environment: 'production',
        userId: 'user-123',
      },
      null,
    );

    expect(result).toEqual({
      enabled: false,
      reason: 'FLAG_NOT_FOUND',
    });
  });

  it('returns false when environment config does not exist', () => {
    const flag: EvaluationFlag = {
      key: 'new-booking-flow',
      configs: [
        {
          environmentKey: 'staging',
          enabled: true,
          defaultValue: true,
          rules: [],
        },
      ],
    };

    const result = evaluateFlag(
      'new-booking-flow',
      {
        environment: 'production',
      },
      flag,
    );

    expect(result).toEqual({
      enabled: false,
      reason: 'ENVIRONMENT_NOT_FOUND',
    });
  });

  it('returns false when flag is disabled in environment', () => {
    const flag: EvaluationFlag = {
      key: 'new-booking-flow',
      configs: [
        {
          environmentKey: 'production',
          enabled: false,
          defaultValue: false,
          rules: [],
        },
      ],
    };

    const result = evaluateFlag(
      'new-booking-flow',
      {
        environment: 'production',
      },
      flag,
    );

    expect(result).toEqual({
      enabled: false,
      reason: 'FLAG_DISABLED',
    });
  });

  it('enables flag for allowed kiosk ids', () => {
    const flag: EvaluationFlag = {
      key: 'new-kiosk-payment-screen',
      configs: [
        {
          environmentKey: 'production',
          enabled: true,
          defaultValue: false,
          rules: [
            {
              attribute: 'kioskId',
              operator: 'IN',
              values: ['KIOSK-102', 'KIOSK-218'],
            },
          ],
        },
      ],
    };

    const result = evaluateFlag(
      'new-kiosk-payment-screen',
      {
        environment: 'production',
        kioskId: 'KIOSK-102',
      },
      flag,
    );

    expect(result).toEqual({
      enabled: true,
      reason: 'TARGETING_MATCH',
    });
  });

  it('returns targeting no match for non-matching kiosk id', () => {
    const flag: EvaluationFlag = {
      key: 'new-kiosk-payment-screen',
      configs: [
        {
          environmentKey: 'production',
          enabled: true,
          defaultValue: false,
          rules: [
            {
              attribute: 'kioskId',
              operator: 'IN',
              values: ['KIOSK-102', 'KIOSK-218'],
            },
          ],
        },
      ],
    };

    const result = evaluateFlag(
      'new-kiosk-payment-screen',
      {
        environment: 'production',
        kioskId: 'KIOSK-999',
      },
      flag,
    );

    expect(result).toEqual({
      enabled: false,
      reason: 'TARGETING_NO_MATCH',
    });
  });

  it('enables admin analytics panel only for admin role', () => {
    const flag: EvaluationFlag = {
      key: 'admin-analytics-panel',
      configs: [
        {
          environmentKey: 'production',
          enabled: true,
          defaultValue: false,
          rules: [
            {
              attribute: 'role',
              operator: 'EQUALS',
              values: ['admin'],
            },
          ],
        },
      ],
    };

    const result = evaluateFlag(
      'admin-analytics-panel',
      {
        environment: 'production',
        role: 'admin',
      },
      flag,
    );

    expect(result).toEqual({
      enabled: true,
      reason: 'TARGETING_MATCH',
    });
  });

  it('returns targeting no match when rules exist but do not match', () => {
    const flag: EvaluationFlag = {
      key: 'admin-analytics-panel',
      configs: [
        {
          environmentKey: 'production',
          enabled: true,
          defaultValue: false,
          rules: [
            {
              attribute: 'role',
              operator: 'EQUALS',
              values: ['admin'],
            },
          ],
        },
      ],
    };

    const result = evaluateFlag(
      'admin-analytics-panel',
      {
        environment: 'production',
        role: 'user',
      },
      flag,
    );

    expect(result).toEqual({
      enabled: false,
      reason: 'TARGETING_NO_MATCH',
    });
  });

  it('keeps percentage rollout deterministic for the same user', () => {
    const flag: EvaluationFlag = {
      key: 'new-checkout',
      configs: [
        {
          environmentKey: 'production',
          enabled: true,
          defaultValue: false,
          rules: [
            {
              attribute: 'userId',
              operator: 'PERCENTAGE_ROLLOUT',
              values: [],
              rolloutPercentage: 10,
            },
          ],
        },
      ],
    };

    const firstResult = evaluateFlag(
      'new-checkout',
      {
        environment: 'production',
        userId: 'user-123',
      },
      flag,
    );

    const secondResult = evaluateFlag(
      'new-checkout',
      {
        environment: 'production',
        userId: 'user-123',
      },
      flag,
    );

    expect(secondResult).toEqual(firstResult);
  });

  it('uses default value when there are no rules', () => {
    const flag: EvaluationFlag = {
      key: 'new-booking-flow',
      configs: [
        {
          environmentKey: 'production',
          enabled: true,
          defaultValue: true,
          rules: [],
        },
      ],
    };

    const result = evaluateFlag(
      'new-booking-flow',
      {
        environment: 'production',
        userId: 'user-123',
      },
      flag,
    );

    expect(result).toEqual({
      enabled: true,
      reason: 'DEFAULT_VALUE',
    });
  });
});
