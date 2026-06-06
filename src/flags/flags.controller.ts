import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CreateFlagDto } from './dto/create-flag.dto';
import { UpdateFlagConfigDto } from './dto/update-flag-config.dto';
import { UpdateFlagDto } from './dto/update-flag.dto';
import { FlagsService } from './flags.service';

@Controller()
export class FlagsController {
  constructor(private readonly flagsService: FlagsService) {}

  @Get('projects/:projectId/flags')
  findByProject(@Param('projectId') projectId: string) {
    return this.flagsService.findByProject(projectId);
  }

  @Post('projects/:projectId/flags')
  create(@Param('projectId') projectId: string, @Body() dto: CreateFlagDto) {
    return this.flagsService.create(projectId, dto);
  }

  @Get('flags/:flagId')
  findOne(@Param('flagId') flagId: string) {
    return this.flagsService.findOne(flagId);
  }

  @Patch('flags/:flagId')
  update(@Param('flagId') flagId: string, @Body() dto: UpdateFlagDto) {
    return this.flagsService.update(flagId, dto);
  }

  @Delete('flags/:flagId')
  remove(@Param('flagId') flagId: string) {
    return this.flagsService.remove(flagId);
  }

  @Get('flags/:flagId/configs')
  findConfigs(@Param('flagId') flagId: string) {
    return this.flagsService.findConfigs(flagId);
  }

  @Patch('flags/:flagId/configs/:environmentId')
  updateConfig(
    @Param('flagId') flagId: string,
    @Param('environmentId') environmentId: string,
    @Body() dto: UpdateFlagConfigDto,
  ) {
    return this.flagsService.updateConfig(flagId, environmentId, dto);
  }
}
