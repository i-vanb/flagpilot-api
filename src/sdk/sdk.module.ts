import { Module } from '@nestjs/common';
import { SdkController } from './sdk.controller';
import { SdkService } from './sdk.service';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { SdkApiKeyGuard } from '../api-keys/guards/sdk-api-key.guard';

@Module({
  imports: [ApiKeysModule],
  controllers: [SdkController],
  providers: [SdkService, SdkApiKeyGuard],
})
export class SdkModule {}
