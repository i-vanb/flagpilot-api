import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import type { Request } from 'express';

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

@Injectable()
export class DemoServiceGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('DEMO_SERVICE_TOKEN');
    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.header('x-demo-service-token') ?? '';

    if (!expected || !provided || !safeEqual(provided, expected)) {
      throw new UnauthorizedException('Invalid demo service token');
    }

    return true;
  }
}
