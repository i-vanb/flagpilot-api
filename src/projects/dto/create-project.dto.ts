import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'key must be kebab-case, for example: plai-platform',
  })
  key: string;

  @IsString()
  @IsOptional()
  description?: string;
}
