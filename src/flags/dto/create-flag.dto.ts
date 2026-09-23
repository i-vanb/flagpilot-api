import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class CreateFlagDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'key must be kebab-case, for example: new-navigation',
  })
  key: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;
}
