import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import * as crypto from 'crypto';
import {
  CacheKey,
  CachedEvaluation,
  CacheMetadata,
  CacheSource,
  CacheConfig,
  CacheStats,
  CacheEntry,
} from '../interfaces/cache.interface';
import { EvaluationResult } from '../../interfaces/evaluation.interface';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AgentPattern } from '../../enums/agent-pattern.enum';

@Injectable()
export class EvaluationCacheService implements OnModuleInit {
  private readonly logger = new Logger(EvaluationCacheService.name);
  private readonly stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    size: 0,
    hitRate: 0,
    avgResponseTime: {
      cached: 0,
      uncached: 0,
    },
  };

  private readonly responseTimes = {
    cached: [] as number[],
    uncached: [] as number[],
  };

  private config: CacheConfig = {
    enabled: true,
    ttl: 3600, // 1 hour default
    maxSize: 10000,
    compression: true,
    warmupOnStart: false,
  };

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit() {
    if (this.config.warmupOnStart) {
      await this.warmupCache();
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.config.enabled) {
      return null;
    }

    const startTime = Date.now();

    try {
      const cached = await this.cacheManager.get<CacheEntry<T>>(key);

      if (cached) {
        this.stats.hits++;
        this.updateHitRate();

        const responseTime = Date.now() - startTime;
        this.recordResponseTime('cached', responseTime);

        await this.updateMetadata(key, cached);

        this.eventEmitter.emit('cache.hit', { key, responseTime });
        return cached.value;
      } else {
        this.stats.misses++;
        this.updateHitRate();

        const responseTime = Date.now() - startTime;
        this.recordResponseTime('cached', responseTime);

        this.eventEmitter.emit('cache.miss', { key, responseTime });
        return null;
      }
    } catch (error) {
      this.logger.error(`Cache get error for key ${key}`, error);
      return null;
    }
  }

  async set<T>(
    key: string,
    value: T,
    options?: {
      ttl?: number;
      source?: CacheSource;
      tags?: string[];
    },
  ): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    try {
      const entry: CacheEntry<T> = {
        value,
        metadata: {
          cachedAt: new Date(),
          hitCount: 0,
          lastAccessed: new Date(),
          source: options?.source || CacheSource.EVALUATION,
          tags: options?.tags,
        },
      };

      const ttl = options?.ttl || this.config.ttl;
      await this.cacheManager.set(key, entry, ttl * 1000);

      this.stats.size++;
      this.eventEmitter.emit('cache.set', { key, ttl });
    } catch (error) {
      this.logger.error(`Cache set error for key ${key}`, error);
    }
  }

  async getEvaluation(
    pattern: AgentPattern,
    input: any,
    expectedOutput?: any,
  ): Promise<EvaluationResult | null> {
    const key = this.generateEvaluationKey(pattern, input, expectedOutput);
    const startTime = Date.now();

    const cached = await this.get<EvaluationResult>(key);

    if (cached) {
      const responseTime = Date.now() - startTime;
      this.logger.debug(`Cache hit for evaluation ${pattern}: ${responseTime}ms`);
    }

    return cached;
  }

  async setEvaluation(
    pattern: AgentPattern,
    input: any,
    result: EvaluationResult,
    expectedOutput?: any,
    ttl?: number,
  ): Promise<void> {
    const key = this.generateEvaluationKey(pattern, input, expectedOutput);

    await this.set(key, result, {
      ttl,
      source: CacheSource.EVALUATION,
      tags: [pattern],
    });
  }

  async invalidate(key: string): Promise<void> {
    try {
      await this.cacheManager.del(key);
      this.stats.size = Math.max(0, this.stats.size - 1);
      this.eventEmitter.emit('cache.invalidated', { key });
    } catch (error) {
      this.logger.error(`Cache invalidation error for key ${key}`, error);
    }
  }

  async invalidatePattern(pattern: AgentPattern): Promise<void> {
    // Cache manager API doesn't support pattern-based key listing
    // This would need to be implemented with a different approach
    const keys: string[] = [];

    for (const key of keys) {
      await this.invalidate(key);
    }

    this.logger.log(`Invalidated ${keys.length} cache entries for pattern ${pattern}`);
  }

  async invalidateAll(): Promise<void> {
    try {
      // Cache manager API changed, using del with all keys approach
      await this.cacheManager.del('*');
      this.stats.size = 0;
      this.eventEmitter.emit('cache.reset');
      this.logger.log('Cache reset completed');
    } catch (error) {
      this.logger.error('Cache reset error', error);
    }
  }

  async getStats(): Promise<CacheStats> {
    return {
      ...this.stats,
      avgResponseTime: {
        cached: this.calculateAvgResponseTime('cached'),
        uncached: this.calculateAvgResponseTime('uncached'),
      },
    };
  }

  async warmupCache(): Promise<void> {
    this.logger.log('Starting cache warmup...');

    // This would typically load frequently accessed evaluations
    // from a database or file system

    this.logger.log('Cache warmup completed');
  }

  generateEvaluationKey(pattern: AgentPattern, input: any, expectedOutput?: any): string {
    const keyData = {
      pattern,
      input: this.normalizeInput(input),
      expectedOutput: expectedOutput ? this.normalizeInput(expectedOutput) : null,
      version: process.env.EVALUATION_VERSION || '1.0',
    };

    const hash = crypto.createHash('sha256').update(JSON.stringify(keyData)).digest('hex');

    return `eval:${pattern}:${hash.substring(0, 16)}`;
  }

  private normalizeInput(input: any): any {
    if (typeof input === 'string') {
      return input.trim().toLowerCase();
    }

    if (Array.isArray(input)) {
      return input.map((item) => this.normalizeInput(item));
    }

    if (typeof input === 'object' && input !== null) {
      const normalized: any = {};
      const keys = Object.keys(input).sort();

      for (const key of keys) {
        normalized[key] = this.normalizeInput(input[key]);
      }

      return normalized;
    }

    return input;
  }

  private async updateMetadata(key: string, entry: CacheEntry<any>): Promise<void> {
    entry.metadata.hitCount++;
    entry.metadata.lastAccessed = new Date();

    await this.cacheManager.set(key, entry, entry.ttl);
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  private recordResponseTime(type: 'cached' | 'uncached', time: number): void {
    this.responseTimes[type].push(time);

    if (this.responseTimes[type].length > 1000) {
      this.responseTimes[type].shift();
    }
  }

  private calculateAvgResponseTime(type: 'cached' | 'uncached'): number {
    const times = this.responseTimes[type];

    if (times.length === 0) {
      return 0;
    }

    const sum = times.reduce((a, b) => a + b, 0);
    return sum / times.length;
  }

  async trackUncachedResponseTime(time: number): Promise<void> {
    this.recordResponseTime('uncached', time);
  }

  updateConfig(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.log('Cache configuration updated', this.config);
  }

  async preloadEvaluations(
    evaluations: Array<{
      pattern: AgentPattern;
      input: any;
      result: EvaluationResult;
      expectedOutput?: any;
    }>,
  ): Promise<void> {
    const startTime = Date.now();
    let loaded = 0;

    for (const evaluation of evaluations) {
      await this.setEvaluation(
        evaluation.pattern,
        evaluation.input,
        evaluation.result,
        evaluation.expectedOutput,
      );
      loaded++;
    }

    const duration = Date.now() - startTime;
    this.logger.log(`Preloaded ${loaded} evaluations in ${duration}ms`);

    this.eventEmitter.emit('cache.preloaded', { count: loaded, duration });
  }
}
