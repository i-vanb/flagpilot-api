import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { SdkModule } from './sdk/sdk.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { FlagsModule } from './flags/flags.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ApiKeysModule,
    PrismaModule,
    SdkModule,
    FlagsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
