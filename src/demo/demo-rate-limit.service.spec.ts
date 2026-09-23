import { HttpException } from '@nestjs/common';
import { DemoRateLimitService } from './demo-rate-limit.service';

describe('DemoRateLimitService', () => {
  it('rejects requests after the configured limit', () => {
    const service = new DemoRateLimitService();

    service.consume('evaluation', 'session-1', 2, 60_000);
    service.consume('evaluation', 'session-1', 2, 60_000);

    expect(() => service.consume('evaluation', 'session-1', 2, 60_000)).toThrow(
      HttpException,
    );
  });

  it('isolates rate-limit subjects', () => {
    const service = new DemoRateLimitService();

    service.consume('mutation', 'session-1', 1, 60_000);

    expect(() =>
      service.consume('mutation', 'session-2', 1, 60_000),
    ).not.toThrow();
  });
});
