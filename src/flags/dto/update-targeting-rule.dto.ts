import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { RuleOperator } from '@prisma/client';

export class UpdateTargetingRuleDto {
  @IsString()
  @IsOptional()
  attribute?: string;

  @IsEnum(RuleOperator)
  @IsOptional()
  operator?: RuleOperator;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @IsOptional()
  values?: string[];

  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  rolloutPercentage?: number;
}
