import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { SdkApiKeyGuard } from '../api-keys/guards/sdk-api-key.guard';
import type { RequestWithSdkApiKey } from '../api-keys/guards/sdk-api-key.guard';
import { EvaluateFlagDto } from './dto/evaluate-flag.dto';
import { SdkService } from './sdk.service';

@Controller('sdk')
export class SdkController {
  constructor(private readonly sdkService: SdkService) {}

  @Post('evaluate')
  @UseGuards(SdkApiKeyGuard)
  async evaluateFlag(
    @Body() dto: EvaluateFlagDto,
    @Req() request: RequestWithSdkApiKey,
  ) {
    return this.sdkService.evaluateFlag({
      flagKey: dto.flagKey,
      context: {
        environment: String(dto.context.environment),
        ...dto.context,
      },
      projectId: request.sdkApiKey!.projectId,
      environmentId: request.sdkApiKey!.environmentId,
    });
  }
}
