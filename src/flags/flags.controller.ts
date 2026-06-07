import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CreateFlagDto } from './dto/create-flag.dto';
import { UpdateFlagConfigDto } from './dto/update-flag-config.dto';
import { UpdateFlagDto } from './dto/update-flag.dto';
import { FlagsService } from './flags.service';
import { CreateTargetingRuleDto } from './dto/create-targeting-rule.dto';
import { UpdateTargetingRuleDto } from './dto/update-targeting-rule.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { type JwtPayload } from '../auth/types/jwt-payload.type';

@Controller()
@UseGuards(JwtAuthGuard)
export class FlagsController {
  constructor(private readonly flagsService: FlagsService) {}

  @Get('projects/:projectId/flags')
  findByProject(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
  ) {
    return this.flagsService.findByProject(user.organizationId, projectId);
  }

  @Post('projects/:projectId/flags')
  create(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Body() dto: CreateFlagDto,
  ) {
    return this.flagsService.create(user.organizationId, projectId, dto);
  }

  @Get('flags/:flagId')
  findOne(@CurrentUser() user: JwtPayload, @Param('flagId') flagId: string) {
    return this.flagsService.findOne(user.organizationId, flagId);
  }

  @Patch('flags/:flagId')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('flagId') flagId: string,
    @Body() dto: UpdateFlagDto,
  ) {
    return this.flagsService.update(user.organizationId, flagId, dto);
  }

  @Delete('flags/:flagId')
  remove(@CurrentUser() user: JwtPayload, @Param('flagId') flagId: string) {
    return this.flagsService.remove(user.organizationId, flagId);
  }

  @Get('flags/:flagId/configs')
  findConfigs(
    @CurrentUser() user: JwtPayload,
    @Param('flagId') flagId: string,
  ) {
    return this.flagsService.findConfigs(user.organizationId, flagId);
  }

  @Patch('flags/:flagId/configs/:environmentId')
  updateConfig(
    @CurrentUser() user: JwtPayload,
    @Param('flagId') flagId: string,
    @Param('environmentId') environmentId: string,
    @Body() dto: UpdateFlagConfigDto,
  ) {
    return this.flagsService.updateConfig(
      user.organizationId,
      flagId,
      environmentId,
      dto,
    );
  }

  @Post('configs/:configId/rules')
  createRule(
    @CurrentUser() user: JwtPayload,
    @Param('configId') configId: string,
    @Body() dto: CreateTargetingRuleDto,
  ) {
    return this.flagsService.createRule(user.organizationId, configId, dto);
  }

  @Patch('rules/:ruleId')
  updateRule(
    @CurrentUser() user: JwtPayload,
    @Param('ruleId') ruleId: string,
    @Body() dto: UpdateTargetingRuleDto,
  ) {
    return this.flagsService.updateRule(user.organizationId, ruleId, dto);
  }

  @Delete('rules/:ruleId')
  removeRule(@CurrentUser() user: JwtPayload, @Param('ruleId') ruleId: string) {
    return this.flagsService.removeRule(user.organizationId, ruleId);
  }
}
