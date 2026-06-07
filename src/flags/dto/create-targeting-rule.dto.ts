import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { RuleOperator } from '@prisma/client';

export class CreateTargetingRuleDto {
  @IsString()
  @IsNotEmpty()
  attribute: string;

  @IsEnum(RuleOperator)
  operator: RuleOperator;

  @ValidateIf((dto: CreateTargetingRuleDto) => {
    return dto.operator !== RuleOperator.PERCENTAGE_ROLLOUT;
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  values: string[];

  @ValidateIf((dto: CreateTargetingRuleDto) => {
    return dto.operator === RuleOperator.PERCENTAGE_ROLLOUT;
  })
  @IsInt()
  @Min(0)
  @Max(100)
  rolloutPercentage?: number;
}
