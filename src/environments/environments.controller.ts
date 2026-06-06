import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CreateEnvironmentDto } from './dto/create-environment.dto';
import { UpdateEnvironmentDto } from './dto/update-environment.dto';
import { EnvironmentsService } from './environments.service';

@Controller()
export class EnvironmentsController {
  constructor(private readonly environmentsService: EnvironmentsService) {}

  @Get('projects/:projectId/environments')
  findByProject(@Param('projectId') projectId: string) {
    return this.environmentsService.findByProject(projectId);
  }

  @Post('projects/:projectId/environments')
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateEnvironmentDto,
  ) {
    return this.environmentsService.create(projectId, dto);
  }

  @Patch('environments/:environmentId')
  update(
    @Param('environmentId') environmentId: string,
    @Body() dto: UpdateEnvironmentDto,
  ) {
    return this.environmentsService.update(environmentId, dto);
  }

  @Delete('environments/:environmentId')
  remove(@Param('environmentId') environmentId: string) {
    return this.environmentsService.remove(environmentId);
  }
}
