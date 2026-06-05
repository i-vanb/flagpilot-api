import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';

@Injectable()
export class ApiKeyHasherService {
  generateRawKey(): string {
    return `fp_live_${randomBytes(32).toString('hex')}`;
  }

  getPrefix(rawKey: string): string {
    return rawKey.slice(0, 16);
  }

  hash(rawKey: string): string {
    const pepper = process.env.API_KEY_PEPPER;

    if (!pepper) {
      throw new Error('API_KEY_PEPPER is not defined');
    }

    return createHash('sha256').update(`${rawKey}.${pepper}`).digest('hex');
  }
}
