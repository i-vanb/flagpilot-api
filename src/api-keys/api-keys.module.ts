import { Module } from '@nestjs/common';
import { ApiKeyHasherService } from './api-key-hasher.service';
import { ApiKeysController } from './api-keys.controller';
import { ApiKeysService } from './api-keys.service';

@Module({
  controllers: [ApiKeysController],
  providers: [ApiKeysService, ApiKeyHasherService],
  exports: [ApiKeyHasherService],
})
export class ApiKeysModule {}
