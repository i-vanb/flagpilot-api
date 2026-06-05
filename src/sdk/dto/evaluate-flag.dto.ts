import { IsNotEmpty, IsObject, IsString } from 'class-validator';

export class EvaluateFlagDto {
  @IsString()
  @IsNotEmpty()
  flagKey: string;

  @IsObject()
  context: Record<string, string | number | boolean>;
}
