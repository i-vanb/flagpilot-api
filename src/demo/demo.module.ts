import { Module } from '@nestjs/common';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { SdkModule } from '../sdk/sdk.module';
import { DemoController } from './demo.controller';
import { DemoRateLimitService } from './demo-rate-limit.service';
import { DemoServiceGuard } from './demo-service.guard';
import { DemoService } from './demo.service';

@Module({
  imports: [ApiKeysModule, SdkModule],
  controllers: [DemoController],
  providers: [DemoService, DemoServiceGuard, DemoRateLimitService],
})
export class DemoModule {}
