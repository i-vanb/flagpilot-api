import { getRolloutBucket, isInRollout } from './rollout';

describe('rollout', () => {
  describe('getRolloutBucket', () => {
    it('returns a stable bucket for the same value', () => {
      const firstBucket = getRolloutBucket('user-123');
      const secondBucket = getRolloutBucket('user-123');

      expect(secondBucket).toBe(firstBucket);
    });

    it('returns a bucket between 0 and 99', () => {
      const bucket = getRolloutBucket('user-123');

      expect(bucket).toBeGreaterThanOrEqual(0);
      expect(bucket).toBeLessThanOrEqual(99);
    });

    it('usually returns different buckets for different values', () => {
      const firstBucket = getRolloutBucket('user-123');
      const secondBucket = getRolloutBucket('user-456');

      expect(typeof firstBucket).toBe('number');
      expect(typeof secondBucket).toBe('number');
    });
  });

  describe('isInRollout', () => {
    it('returns false when percentage is 0', () => {
      expect(isInRollout('user-123', 0)).toBe(false);
    });

    it('returns true when percentage is 100', () => {
      expect(isInRollout('user-123', 100)).toBe(true);
    });

    it('returns false when percentage is below or equal to 0', () => {
      expect(isInRollout('user-123', -10)).toBe(false);
    });

    it('returns true when percentage is above or equal to 100', () => {
      expect(isInRollout('user-123', 150)).toBe(true);
    });

    it('is deterministic for the same value and percentage', () => {
      const firstResult = isInRollout('user-123', 10);
      const secondResult = isInRollout('user-123', 10);

      expect(secondResult).toBe(firstResult);
    });
  });
});
