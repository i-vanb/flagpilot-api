import { ArrayNotEmpty, IsArray, IsObject, IsString } from 'class-validator';

export class EvaluateFlagsBatchDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  flagKeys: string[];

  @IsObject()
  context: Record<string, string | number | boolean>;
}
