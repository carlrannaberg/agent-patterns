import { EvaluationResult } from '../../interfaces/evaluation.interface';
import { TestRun } from './runner.interface';
import { BatchResults } from './batch.interface';

export interface CacheKey {
  pattern: string;
  input: string;
  expectedOutput?: string;
  version?: string;
}

export interface CachedEvaluation {
  key: string;
  result: EvaluationResult;
  metadata: CacheMetadata;
  expiresAt: Date;
}

export interface CacheMetadata {
  cachedAt: Date;
  hitCount: number;
  lastAccessed: Date;
  source: CacheSource;
  tags?: string[];
}

export enum CacheSource {
  EVALUATION = 'evaluation',
  TEST_RUN = 'test-run',
  BATCH = 'batch',
  API_TEST = 'api-test',
}

export interface CacheConfig {
  enabled: boolean;
  ttl: number;
  maxSize?: number;
  evictionPolicy?: EvictionPolicy;
  warmupOnStart?: boolean;
  compression?: boolean;
}

export enum EvictionPolicy {
  LRU = 'lru',
  LFU = 'lfu',
  FIFO = 'fifo',
  RANDOM = 'random',
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  hitRate: number;
  avgResponseTime: {
    cached: number;
    uncached: number;
  };
}

export interface CacheEntry<T> {
  value: T;
  metadata: CacheMetadata;
  ttl?: number;
}