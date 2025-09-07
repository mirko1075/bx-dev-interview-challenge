import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly cache = new Map<string, CacheItem<any>>();
  private readonly defaultTtl = 5 * 60 * 1000; // 5 minutes

  constructor(private readonly configService: ConfigService) {
    // Clean up expired items every minute
    setInterval(() => this.cleanup(), 60 * 1000);
  }

  set<T>(key: string, data: T, ttl: number = this.defaultTtl): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
    this.logger.debug(`Cache set: ${key} (TTL: ${ttl}ms)`);
  }

  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }

    const now = Date.now();
    if (now - item.timestamp > item.ttl) {
      this.cache.delete(key);
      this.logger.debug(`Cache expired and removed: ${key}`);
      return null;
    }

    this.logger.debug(`Cache hit: ${key}`);
    return item.data as T;
  }

  has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) return false;

    const now = Date.now();
    if (now - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.logger.debug(`Cache deleted: ${key}`);
    }
    return deleted;
  }

  clear(): void {
    this.cache.clear();
    this.logger.log('Cache cleared');
  }

  private cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug(`Cache cleanup: removed ${cleanedCount} expired items`);
    }
  }

  getStats(): { size: number; memoryUsage: string } {
    const size = this.cache.size;
    const memoryUsage = `${Math.round(JSON.stringify([...this.cache.entries()]).length / 1024)} KB`;
    
    return { size, memoryUsage };
  }
}
