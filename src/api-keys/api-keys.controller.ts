import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller()
@UseGuards(JwtAuthGuard)
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Get('projects/:projectId/api-keys')
  findByProject(@Param('projectId') projectId: string) {
    return this.apiKeysService.findByProject(projectId);
  }

  @Post('projects/:projectId/api-keys')
  create(@Param('projectId') projectId: string, @Body() dto: CreateApiKeyDto) {
    return this.apiKeysService.create(projectId, dto);
  }

  @Post('api-keys/:apiKeyId/rotate')
  rotate(@Param('apiKeyId') apiKeyId: string) {
    return this.apiKeysService.rotate(apiKeyId);
  }

  @Delete('api-keys/:apiKeyId')
  revoke(@Param('apiKeyId') apiKeyId: string) {
    return this.apiKeysService.revoke(apiKeyId);
  }
}
