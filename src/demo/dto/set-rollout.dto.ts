import { IsIn } from 'class-validator';

export class SetRolloutDto {
  @IsIn([0, 50, 100])
  percentage: 0 | 50 | 100;
}
