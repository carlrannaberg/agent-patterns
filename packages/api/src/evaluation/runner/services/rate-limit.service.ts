import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  RateLimitConfig,
  RateLimitStrategy,
  RateLimitState,
  RateLimitViolation,
  ViolationType,
  QuotaConfig,
  QuotaUsage,
  QuotaPeriod,
  QuotaLimit,
  AdaptiveRateLimitConfig,
} from '../interfaces/rate-limit.interface';
import { AgentPattern } from '../../enums/agent-pattern.enum';

@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);
  private readonly rateLimitStates = new Map<string, RateLimitState>();
  private readonly quotaUsage = new Map<string, Map<QuotaPeriod, QuotaUsage>>();
  private readonly violations: RateLimitViolation[] = [];
  private readonly tokenBuckets = new Map<string, TokenBucket>();

  private adaptiveConfig: AdaptiveRateLimitConfig = {
    enabled: true,
    minRequests: 10,
    maxRequests: 100,
    adjustmentFactor: 0.1,
    errorThreshold: 0.2,
    successThreshold: 0.95,
    adjustmentInterval: 300000, // 5 minutes
  };

  private currentLimits = new Map<string, number>();
  private performanceMetrics = new Map<string, PerformanceMetric>();

  constructor(private readonly eventEmitter: EventEmitter2) {
    this.startAdaptiveAdjustment();
  }

  async checkRateLimit(
    identifier: string,
    config: RateLimitConfig,
    tokenCount: number = 0,
  ): Promise<boolean> {
    const state = this.getOrCreateState(identifier);
    const now = Date.now();

    switch (config.strategy) {
      case RateLimitStrategy.SLIDING_WINDOW:
        return this.checkSlidingWindow(identifier, state, config, now, tokenCount);

      case RateLimitStrategy.FIXED_WINDOW:
        return this.checkFixedWindow(identifier, state, config, now, tokenCount);

      case RateLimitStrategy.TOKEN_BUCKET:
        return this.checkTokenBucket(identifier, config, tokenCount);

      case RateLimitStrategy.LEAKY_BUCKET:
        return this.checkLeakyBucket(identifier, config, tokenCount);

      default:
        throw new Error(`Unknown rate limit strategy: ${config.strategy}`);
    }
  }

  async checkQuota(
    identifier: string,
    pattern: AgentPattern,
    config: QuotaConfig,
    tokenCount: number = 0,
  ): Promise<boolean> {
    const usageMap = this.getOrCreateQuotaUsage(identifier);
    const now = new Date();

    for (const [period, limit] of Object.entries(config)) {
      if (period === 'perPattern') continue;

      const quotaPeriod = this.getPeriodEnum(period);
      const usage = this.getOrCreateUsage(usageMap, quotaPeriod, limit as QuotaLimit);

      if (this.isQuotaPeriodExpired(usage, now)) {
        this.resetQuotaUsage(usage, limit as QuotaLimit, now);
      }

      if (
        usage.requests + 1 > usage.remaining.requests ||
        usage.tokens + tokenCount > usage.remaining.tokens ||
        usage.evaluations + 1 > usage.remaining.evaluations
      ) {
        this.recordViolation({
          timestamp: now,
          type: ViolationType.QUOTA_EXCEEDED,
          limit: usage.remaining.requests,
          attempted: usage.requests + 1,
          pattern: pattern,
          metadata: { period, identifier },
        });

        return false;
      }
    }

    if (config.perPattern) {
      const patternLimit = config.perPattern.get(pattern);
      if (
        patternLimit &&
        !(await this.checkPatternQuota(identifier, pattern, patternLimit, tokenCount))
      ) {
        return false;
      }
    }

    this.updateQuotaUsage(usageMap, tokenCount);
    return true;
  }

  async waitForRateLimit(
    identifier: string,
    config: RateLimitConfig,
    tokenCount: number = 0,
  ): Promise<void> {
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      if (await this.checkRateLimit(identifier, config, tokenCount)) {
        return;
      }

      const backoffMs = Math.min(1000 * Math.pow(2, attempts), 30000);
      await this.delay(backoffMs);
      attempts++;
    }

    throw new Error(`Rate limit exceeded after ${maxAttempts} attempts`);
  }

  async trackConcurrent(
    identifier: string,
    operation: () => Promise<any>,
    maxConcurrent: number,
  ): Promise<any> {
    const state = this.getOrCreateState(identifier);

    if (state.concurrent >= maxConcurrent) {
      this.recordViolation({
        timestamp: new Date(),
        type: ViolationType.CONCURRENT_LIMIT,
        limit: maxConcurrent,
        attempted: state.concurrent + 1,
        metadata: { identifier },
      });

      throw new Error(`Concurrent limit exceeded: ${state.concurrent}/${maxConcurrent}`);
    }

    state.concurrent++;

    try {
      return await operation();
    } finally {
      state.concurrent--;
    }
  }

  getViolations(since?: Date): RateLimitViolation[] {
    if (since) {
      return this.violations.filter((v) => v.timestamp >= since);
    }
    return [...this.violations];
  }

  getRateLimitState(identifier: string): RateLimitState | undefined {
    return this.rateLimitStates.get(identifier);
  }

  getQuotaUsage(identifier: string): Map<QuotaPeriod, QuotaUsage> | undefined {
    return this.quotaUsage.get(identifier);
  }

  resetRateLimit(identifier: string): void {
    this.rateLimitStates.delete(identifier);
    this.tokenBuckets.delete(identifier);
    this.logger.log(`Rate limit reset for ${identifier}`);
  }

  resetQuota(identifier: string, period?: QuotaPeriod): void {
    const usageMap = this.quotaUsage.get(identifier);
    if (!usageMap) return;

    if (period) {
      usageMap.delete(period);
    } else {
      this.quotaUsage.delete(identifier);
    }

    this.logger.log(`Quota reset for ${identifier} ${period || 'all periods'}`);
  }

  private checkSlidingWindow(
    identifier: string,
    state: RateLimitState,
    config: RateLimitConfig,
    now: number,
    tokenCount: number,
  ): boolean {
    const windowStart = now - config.windowMs;

    if (state.windowStart.getTime() < windowStart) {
      const timePassed = now - state.windowStart.getTime();
      const windowsPassed = timePassed / config.windowMs;

      state.requests = Math.max(0, state.requests - Math.floor(windowsPassed * config.maxRequests));
      state.tokens = Math.max(
        0,
        state.tokens - Math.floor(windowsPassed * (config.maxTokens || 0)),
      );
      state.windowStart = new Date(windowStart);
    }

    const effectiveMaxRequests = this.getAdaptiveLimit(identifier, config.maxRequests);

    if (state.requests >= effectiveMaxRequests) {
      this.recordViolation({
        timestamp: new Date(),
        type: ViolationType.REQUEST_LIMIT,
        limit: effectiveMaxRequests,
        attempted: state.requests + 1,
        metadata: { identifier, strategy: 'sliding-window' },
      });
      return false;
    }

    if (config.maxTokens && state.tokens + tokenCount > config.maxTokens) {
      this.recordViolation({
        timestamp: new Date(),
        type: ViolationType.TOKEN_LIMIT,
        limit: config.maxTokens,
        attempted: state.tokens + tokenCount,
        metadata: { identifier, strategy: 'sliding-window' },
      });
      return false;
    }

    state.requests++;
    state.tokens += tokenCount;
    state.lastRequest = new Date();

    return true;
  }

  private checkFixedWindow(
    identifier: string,
    state: RateLimitState,
    config: RateLimitConfig,
    now: number,
    tokenCount: number,
  ): boolean {
    if (now - state.windowStart.getTime() >= config.windowMs) {
      state.requests = 0;
      state.tokens = 0;
      state.windowStart = new Date(now);
    }

    const effectiveMaxRequests = this.getAdaptiveLimit(identifier, config.maxRequests);

    if (state.requests >= effectiveMaxRequests) {
      this.recordViolation({
        timestamp: new Date(),
        type: ViolationType.REQUEST_LIMIT,
        limit: effectiveMaxRequests,
        attempted: state.requests + 1,
        metadata: { identifier, strategy: 'fixed-window' },
      });
      return false;
    }

    if (config.maxTokens && state.tokens + tokenCount > config.maxTokens) {
      this.recordViolation({
        timestamp: new Date(),
        type: ViolationType.TOKEN_LIMIT,
        limit: config.maxTokens,
        attempted: state.tokens + tokenCount,
        metadata: { identifier, strategy: 'fixed-window' },
      });
      return false;
    }

    state.requests++;
    state.tokens += tokenCount;
    state.lastRequest = new Date();

    return true;
  }

  private checkTokenBucket(
    identifier: string,
    config: RateLimitConfig,
    tokenCount: number,
  ): boolean {
    let bucket = this.tokenBuckets.get(identifier);

    if (!bucket) {
      bucket = {
        tokens: config.maxRequests,
        capacity: config.maxRequests,
        refillRate: config.maxRequests / (config.windowMs / 1000),
        lastRefill: Date.now(),
      };
      this.tokenBuckets.set(identifier, bucket);
    }

    const now = Date.now();
    const timePassed = (now - bucket.lastRefill) / 1000;
    bucket.tokens = Math.min(bucket.capacity, bucket.tokens + timePassed * bucket.refillRate);
    bucket.lastRefill = now;

    const requiredTokens = Math.max(1, tokenCount);

    if (bucket.tokens < requiredTokens) {
      this.recordViolation({
        timestamp: new Date(),
        type: ViolationType.REQUEST_LIMIT,
        limit: bucket.capacity,
        attempted: requiredTokens,
        metadata: { identifier, strategy: 'token-bucket', availableTokens: bucket.tokens },
      });
      return false;
    }

    bucket.tokens -= requiredTokens;
    return true;
  }

  private checkLeakyBucket(
    identifier: string,
    config: RateLimitConfig,
    tokenCount: number,
  ): boolean {
    // Simplified leaky bucket implementation
    return this.checkTokenBucket(identifier, config, tokenCount);
  }

  private getOrCreateState(identifier: string): RateLimitState {
    let state = this.rateLimitStates.get(identifier);

    if (!state) {
      state = {
        requests: 0,
        tokens: 0,
        concurrent: 0,
        windowStart: new Date(),
        lastRequest: new Date(),
        violations: 0,
      };
      this.rateLimitStates.set(identifier, state);
    }

    return state;
  }

  private getOrCreateQuotaUsage(identifier: string): Map<QuotaPeriod, QuotaUsage> {
    let usageMap = this.quotaUsage.get(identifier);

    if (!usageMap) {
      usageMap = new Map();
      this.quotaUsage.set(identifier, usageMap);
    }

    return usageMap;
  }

  private getOrCreateUsage(
    usageMap: Map<QuotaPeriod, QuotaUsage>,
    period: QuotaPeriod,
    limit: QuotaLimit,
  ): QuotaUsage {
    let usage = usageMap.get(period);

    if (!usage) {
      usage = {
        period,
        requests: 0,
        tokens: 0,
        evaluations: 0,
        remaining: { ...limit },
        resetAt: this.getResetTime(period),
      };
      usageMap.set(period, usage);
    }

    return usage;
  }

  private updateQuotaUsage(usageMap: Map<QuotaPeriod, QuotaUsage>, tokenCount: number): void {
    for (const usage of usageMap.values()) {
      usage.requests++;
      usage.tokens += tokenCount;
      usage.evaluations++;
      usage.remaining.requests--;
      usage.remaining.tokens -= tokenCount;
      usage.remaining.evaluations--;
    }
  }

  private checkPatternQuota(
    identifier: string,
    pattern: AgentPattern,
    limit: QuotaLimit,
    tokenCount: number,
  ): boolean {
    const key = `${identifier}-${pattern}`;
    const usageMap = this.getOrCreateQuotaUsage(key);
    const usage = this.getOrCreateUsage(usageMap, QuotaPeriod.DAILY, limit);

    if (
      usage.requests + 1 > limit.requests ||
      usage.tokens + tokenCount > limit.tokens ||
      usage.evaluations + 1 > limit.evaluations
    ) {
      this.recordViolation({
        timestamp: new Date(),
        type: ViolationType.QUOTA_EXCEEDED,
        limit: limit.requests,
        attempted: usage.requests + 1,
        pattern: pattern,
        metadata: { identifier, patternQuota: true },
      });

      return false;
    }

    return true;
  }

  private isQuotaPeriodExpired(usage: QuotaUsage, now: Date): boolean {
    return now >= usage.resetAt;
  }

  private resetQuotaUsage(usage: QuotaUsage, limit: QuotaLimit, now: Date): void {
    usage.requests = 0;
    usage.tokens = 0;
    usage.evaluations = 0;
    usage.remaining = { ...limit };
    usage.resetAt = this.getResetTime(usage.period, now);
  }

  private getResetTime(period: QuotaPeriod, from: Date = new Date()): Date {
    const resetDate = new Date(from);

    switch (period) {
      case QuotaPeriod.HOURLY:
        resetDate.setHours(resetDate.getHours() + 1, 0, 0, 0);
        break;
      case QuotaPeriod.DAILY:
        resetDate.setDate(resetDate.getDate() + 1);
        resetDate.setHours(0, 0, 0, 0);
        break;
      case QuotaPeriod.MONTHLY:
        resetDate.setMonth(resetDate.getMonth() + 1, 1);
        resetDate.setHours(0, 0, 0, 0);
        break;
    }

    return resetDate;
  }

  private getPeriodEnum(period: string): QuotaPeriod {
    switch (period.toLowerCase()) {
      case 'hourly':
        return QuotaPeriod.HOURLY;
      case 'daily':
        return QuotaPeriod.DAILY;
      case 'monthly':
        return QuotaPeriod.MONTHLY;
      default:
        throw new Error(`Unknown quota period: ${period}`);
    }
  }

  private recordViolation(violation: RateLimitViolation): void {
    this.violations.push(violation);

    if (this.violations.length > 10000) {
      this.violations.shift();
    }

    this.eventEmitter.emit('ratelimit.violation', violation);
  }

  private getAdaptiveLimit(identifier: string, baseLimit: number): number {
    if (!this.adaptiveConfig.enabled) {
      return baseLimit;
    }

    const currentLimit = this.currentLimits.get(identifier);
    if (currentLimit !== undefined) {
      return currentLimit;
    }

    this.currentLimits.set(identifier, baseLimit);
    return baseLimit;
  }

  private startAdaptiveAdjustment(): void {
    if (!this.adaptiveConfig.enabled) return;

    setInterval(() => {
      for (const [identifier, limit] of this.currentLimits.entries()) {
        const metrics = this.performanceMetrics.get(identifier);
        if (!metrics) continue;

        const errorRate = metrics.errors / (metrics.requests || 1);
        const successRate = 1 - errorRate;

        let newLimit = limit;

        if (errorRate > this.adaptiveConfig.errorThreshold) {
          newLimit = Math.max(
            this.adaptiveConfig.minRequests,
            Math.floor(limit * (1 - this.adaptiveConfig.adjustmentFactor)),
          );
        } else if (successRate > this.adaptiveConfig.successThreshold) {
          newLimit = Math.min(
            this.adaptiveConfig.maxRequests,
            Math.ceil(limit * (1 + this.adaptiveConfig.adjustmentFactor)),
          );
        }

        if (newLimit !== limit) {
          this.currentLimits.set(identifier, newLimit);
          this.logger.log(`Adjusted rate limit for ${identifier}: ${limit} -> ${newLimit}`);
          this.eventEmitter.emit('ratelimit.adjusted', { identifier, oldLimit: limit, newLimit });
        }

        // Reset metrics
        this.performanceMetrics.set(identifier, { requests: 0, errors: 0 });
      }
    }, this.adaptiveConfig.adjustmentInterval);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

interface TokenBucket {
  tokens: number;
  capacity: number;
  refillRate: number;
  lastRefill: number;
}

interface PerformanceMetric {
  requests: number;
  errors: number;
}
