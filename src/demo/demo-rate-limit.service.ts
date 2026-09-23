import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

type RateLimitBucket = {
  timestamps: number[];
};

@Injectable()
export class DemoRateLimitService {
  private readonly buckets = new Map<string, RateLimitBucket>();

  consume(scope: string, subject: string, limit: number, windowMs: number) {
    const now = Date.now();
    const key = `${scope}:${subject}`;
    const cutoff = now - windowMs;
    const recent = (this.buckets.get(key)?.timestamps ?? []).filter(
      (timestamp) => timestamp > cutoff,
    );

    if (recent.length >= limit) {
      throw new HttpException(
        'Runtime Control demo rate limit exceeded',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    recent.push(now);
    this.buckets.set(key, { timestamps: recent });

    if (this.buckets.size > 2_000) {
      this.prune(cutoff);
    }
  }

  private prune(cutoff: number) {
    for (const [key, bucket] of this.buckets) {
      const recent = bucket.timestamps.filter(
        (timestamp) => timestamp > cutoff,
      );

      if (recent.length === 0) {
        this.buckets.delete(key);
      } else {
        this.buckets.set(key, { timestamps: recent });
      }
    }
  }
}
