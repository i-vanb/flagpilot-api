import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  UseGuards,
} from '@nestjs/common';
import { EvaluateFlagDto } from '../sdk/dto/evaluate-flag.dto';
import { EvaluateFlagsBatchDto } from '../sdk/dto/evaluate-flags-batch.dto';
import { DemoServiceGuard } from './demo-service.guard';
import { DemoService } from './demo.service';
import { SetNavigationDto } from './dto/set-navigation.dto';
import { SetRolloutDto } from './dto/set-rollout.dto';

@Controller('demo')
@UseGuards(DemoServiceGuard)
export class DemoController {
  constructor(private readonly demoService: DemoService) {}

  @Post('sessions')
  createSession(@Headers('x-demo-client-id') clientId = '') {
    return this.demoService.createSession(clientId);
  }

  @Get('session')
  getSession(@Headers('x-demo-session-token') sessionToken = '') {
    return this.demoService.getSessionState(sessionToken);
  }

  @Post('navigation')
  setNavigation(
    @Headers('x-demo-session-token') sessionToken = '',
    @Body() dto: SetNavigationDto,
  ) {
    return this.demoService.setNavigation(sessionToken, dto.enabled);
  }

  @Post('rollout')
  setRollout(
    @Headers('x-demo-session-token') sessionToken = '',
    @Body() dto: SetRolloutDto,
  ) {
    return this.demoService.setRollout(sessionToken, dto.percentage);
  }

  @Post('reset')
  reset(@Headers('x-demo-session-token') sessionToken = '') {
    return this.demoService.reset(sessionToken);
  }

  @Post('sdk/evaluate')
  evaluate(
    @Headers('x-demo-session-token') sessionToken = '',
    @Headers('x-api-key') apiKey = '',
    @Body() dto: EvaluateFlagDto,
  ) {
    return this.demoService.evaluateFlag(sessionToken, apiKey, dto);
  }

  @Post('sdk/evaluate/batch')
  evaluateBatch(
    @Headers('x-demo-session-token') sessionToken = '',
    @Headers('x-api-key') apiKey = '',
    @Body() dto: EvaluateFlagsBatchDto,
  ) {
    return this.demoService.evaluateBatch(sessionToken, apiKey, dto);
  }
}
