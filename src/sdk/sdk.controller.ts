import { Body, Controller, Post } from '@nestjs/common';
import { SdkService } from './sdk.service';
import { EvaluateFlagDto } from './dto/evaluate-flag.dto';

@Controller('sdk')
export class SdkController {
  constructor(private readonly sdkService: SdkService) {}

  @Post('evaluate')
  async evaluateFlag(@Body() dto: EvaluateFlagDto) {
    return this.sdkService.evaluateFlag({
      flagKey: dto.flagKey,
      context: {
        environment: String(dto.context.environment),
        ...dto.context,
      },
    });
  }
}
