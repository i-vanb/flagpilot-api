import { ApiKeyHasherService } from './api-key-hasher.service';

describe('ApiKeyHasherService', () => {
  let service: ApiKeyHasherService;
  const originalApiKeyPepper = process.env.API_KEY_PEPPER;

  beforeEach(() => {
    process.env.API_KEY_PEPPER = 'test-pepper';
    service = new ApiKeyHasherService();
  });

  afterAll(() => {
    process.env.API_KEY_PEPPER = originalApiKeyPepper;
  });

  describe('generateRawKey', () => {
    it('generates a key with fp_live_ prefix', () => {
      const rawKey = service.generateRawKey();

      expect(rawKey.startsWith('fp_live_')).toBe(true);
    });

    it('generates different keys', () => {
      const firstKey = service.generateRawKey();
      const secondKey = service.generateRawKey();

      expect(secondKey).not.toBe(firstKey);
    });
  });

  describe('getPrefix', () => {
    it('returns the first 16 characters of the raw key', () => {
      const rawKey = 'fp_live_123456789abcdefghijklmnopqrstuvwxyz';

      const prefix = service.getPrefix(rawKey);

      expect(prefix).toBe(rawKey.slice(0, 16));
    });
  });

  describe('hash', () => {
    it('returns a deterministic hash for the same raw key and pepper', () => {
      const rawKey = 'fp_live_test_key';

      const firstHash = service.hash(rawKey);
      const secondHash = service.hash(rawKey);

      expect(secondHash).toBe(firstHash);
    });

    it('returns different hashes for different raw keys', () => {
      const firstHash = service.hash('fp_live_first_key');
      const secondHash = service.hash('fp_live_second_key');

      expect(secondHash).not.toBe(firstHash);
    });

    it('returns a sha256 hex hash', () => {
      const hash = service.hash('fp_live_test_key');

      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('depends on API_KEY_PEPPER', () => {
      const rawKey = 'fp_live_test_key';

      process.env.API_KEY_PEPPER = 'first-pepper';
      const firstHash = service.hash(rawKey);

      process.env.API_KEY_PEPPER = 'second-pepper';
      const secondHash = service.hash(rawKey);

      expect(secondHash).not.toBe(firstHash);
    });

    it('throws when API_KEY_PEPPER is not defined', () => {
      delete process.env.API_KEY_PEPPER;

      expect(() => service.hash('fp_live_test_key')).toThrow(
        'API_KEY_PEPPER is not defined',
      );
    });
  });
});
