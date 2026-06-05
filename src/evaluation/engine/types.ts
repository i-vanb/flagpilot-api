export type EvaluationContext = {
  environment: string;
  [key: string]: string | number | boolean | undefined;
};

export type EvaluationReason =
  | 'FLAG_NOT_FOUND'
  | 'ENVIRONMENT_NOT_FOUND'
  | 'FLAG_DISABLED'
  | 'TARGETING_MATCH'
  | 'TARGETING_NO_MATCH'
  | 'ROLLOUT_MATCH'
  | 'ROLLOUT_NO_MATCH'
  | 'DEFAULT_VALUE';

export type EvaluationResult = {
  enabled: boolean;
  reason: EvaluationReason;
};

export type EvaluationRuleOperator =
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'IN'
  | 'NOT_IN'
  | 'PERCENTAGE_ROLLOUT';

export type EvaluationRule = {
  attribute: string;
  operator: EvaluationRuleOperator;
  values: string[];
  rolloutPercentage?: number | null;
};

export type EvaluationFlagConfig = {
  environmentKey: string;
  enabled: boolean;
  defaultValue: boolean;
  rules: EvaluationRule[];
};

export type EvaluationFlag = {
  key: string;
  configs: EvaluationFlagConfig[];
};

export type RuleEvaluationResult = {
  matched: boolean;
  reason: EvaluationReason;
};
