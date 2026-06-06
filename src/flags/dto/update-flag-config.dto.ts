import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateFlagConfigDto {
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsBoolean()
  @IsOptional()
  defaultValue?: boolean;
}
