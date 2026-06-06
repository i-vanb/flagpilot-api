import { IsOptional, IsString } from 'class-validator';

export class CreateApiKeyDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  environmentId?: string;
}
