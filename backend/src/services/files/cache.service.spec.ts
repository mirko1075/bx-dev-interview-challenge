import { CacheService } from './cache.service';
import { ConfigService } from '@nestjs/config';

jest.useFakeTimers();

describe('CacheService', () => {
  let cacheService: CacheService;
  let configService: ConfigService;

  beforeEach(() => {
    configService = {} as ConfigService;
    cacheService = new CacheService(configService);

    jest.spyOn(global, 'setInterval').mockImplementation(() => {
      return 1;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should set and get a value', () => {
    cacheService.set('foo', 'bar');
    expect(cacheService.get('foo')).toBe('bar');
  });

  it('should return null for missing key', () => {
    expect(cacheService.get('missing')).toBeNull();
  });

  it('should expire items after TTL', () => {
    cacheService.set('foo', 'bar', 1000);
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 2000);
    expect(cacheService.get('foo')).toBeNull();
  });

  it('should not expire items before TTL', () => {
    cacheService.set('foo', 'bar', 1000);
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 500);
    expect(cacheService.get('foo')).toBe('bar');
  });

  it('should delete a key', () => {
    cacheService.set('foo', 'bar');
    expect(cacheService.delete('foo')).toBe(true);
    expect(cacheService.get('foo')).toBeNull();
  });

  it('should return false when deleting non-existent key', () => {
    expect(cacheService.delete('nope')).toBe(false);
  });

  it('should clear all keys', () => {
    cacheService.set('foo', 'bar');
    cacheService.set('baz', 'qux');
    cacheService.clear();
    expect(cacheService.get('foo')).toBeNull();
    expect(cacheService.get('baz')).toBeNull();
  });

  it('should return correct has() status', () => {
    cacheService.set('foo', 'bar');
    expect(cacheService.has('foo')).toBe(true);
    expect(cacheService.has('baz')).toBe(false);
  });

  it('should return false for has() after TTL', () => {
    cacheService.set('foo', 'bar', 1000);
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 2000);
    expect(cacheService.has('foo')).toBe(false);
  });

  it('should cleanup expired items', () => {
    cacheService.set('foo', 'bar', 1000);
    cacheService.set('baz', 'qux', 1000);
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 2000);
    cacheService['cleanup']();
    expect(cacheService.get('foo')).toBeNull();
    expect(cacheService.get('baz')).toBeNull();
  });

  it('should return correct stats', () => {
    cacheService.set('foo', 'bar');
    const stats = cacheService.getStats();
    expect(stats.size).toBe(1);
    expect(typeof stats.memoryUsage).toBe('string');
    expect(stats.memoryUsage.endsWith('KB')).toBe(true);
  });
});
