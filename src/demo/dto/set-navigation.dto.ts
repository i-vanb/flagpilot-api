import { IsBoolean } from 'class-validator';

export class SetNavigationDto {
  @IsBoolean()
  enabled: boolean;
}
