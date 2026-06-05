import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiKeyHasherService } from '../../api-keys/api-key-hasher.service';

export type SdkApiKeyContext = {
  apiKeyId: string;
  organizationId: string;
  projectId: string;
  environmentId: string | null;
};

export type RequestWithSdkApiKey = Request & {
  sdkApiKey?: SdkApiKeyContext;
};

@Injectable()
export class SdkApiKeyGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly apiKeyHasher: ApiKeyHasherService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithSdkApiKey>();

    const rawApiKey = request.header('x-api-key');

    if (!rawApiKey) {
      throw new UnauthorizedException('Missing x-api-key header');
    }

    const prefix = this.apiKeyHasher.getPrefix(rawApiKey);
    const keyHash = this.apiKeyHasher.hash(rawApiKey);

    const apiKey = await this.prisma.apiKey.findFirst({
      where: {
        prefix,
        keyHash,
        revokedAt: null,
      },
    });

    if (!apiKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    await this.prisma.apiKey.update({
      where: {
        id: apiKey.id,
      },
      data: {
        lastUsedAt: new Date(),
      },
    });

    request.sdkApiKey = {
      apiKeyId: apiKey.id,
      organizationId: apiKey.organizationId,
      projectId: apiKey.projectId,
      environmentId: apiKey.environmentId,
    };

    return true;
  }
}
