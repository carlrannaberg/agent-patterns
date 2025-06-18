import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RateLimitService } from './rate-limit.service';
import {
  RateLimitConfig,
  RateLimitStrategy,
  QuotaConfig,
  QuotaPeriod,
  ViolationType,
} from '../interfaces/rate-limit.interface';
import { AgentPattern } from '../../enums/agent-pattern.enum';

describe('RateLimitService', () => {
  let service: RateLimitService;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimitService,
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<RateLimitService>(RateLimitService);
    eventEmitter = module.get(EventEmitter2);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkRateLimit', () => {
    it('should allow requests within rate limit', async () => {
      const config: RateLimitConfig = {
        windowMs: 60000,
        maxRequests: 10,
        strategy: RateLimitStrategy.SLIDING_WINDOW,
      };

      const result1 = await service.checkRateLimit('test-id', config);
      const result2 = await service.checkRateLimit('test-id', config);

      expect(result1).toBe(true);
      expect(result2).toBe(true);
    });

    it('should block requests exceeding rate limit', async () => {
      const config: RateLimitConfig = {
        windowMs: 60000,
        maxRequests: 2,
        strategy: RateLimitStrategy.SLIDING_WINDOW,
      };

      await service.checkRateLimit('test-id', config);
      await service.checkRateLimit('test-id', config);
      const result = await service.checkRateLimit('test-id', config);

      expect(result).toBe(false);
      expect(eventEmitter.emit).toHaveBeenCalledWith('ratelimit.violation', expect.objectContaining({
        type: ViolationType.REQUEST_LIMIT,
      }));
    });

    it('should track token usage', async () => {
      const config: RateLimitConfig = {
        windowMs: 60000,
        maxRequests: 10,
        maxTokens: 100,
        strategy: RateLimitStrategy.SLIDING_WINDOW,
      };

      const result1 = await service.checkRateLimit('test-id', config, 50);
      const result2 = await service.checkRateLimit('test-id', config, 40);
      const result3 = await service.checkRateLimit('test-id', config, 20);

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(result3).toBe(false);
    });

    it('should handle fixed window strategy', async () => {
      const config: RateLimitConfig = {
        windowMs: 1000,
        maxRequests: 2,
        strategy: RateLimitStrategy.FIXED_WINDOW,
      };

      await service.checkRateLimit('test-id', config);
      await service.checkRateLimit('test-id', config);
      const result1 = await service.checkRateLimit('test-id', config);

      expect(result1).toBe(false);

      // Wait for window to reset
      await new Promise(resolve => setTimeout(resolve, 1100));
      const result2 = await service.checkRateLimit('test-id', config);

      expect(result2).toBe(true);
    });

    it('should handle token bucket strategy', async () => {
      const config: RateLimitConfig = {
        windowMs: 1000,
        maxRequests: 10,
        strategy: RateLimitStrategy.TOKEN_BUCKET,
      };

      // Consume all tokens
      for (let i = 0; i < 10; i++) {
        await service.checkRateLimit('test-id', config);
      }

      const result = await service.checkRateLimit('test-id', config);
      expect(result).toBe(false);
    });
  });

  describe('checkQuota', () => {
    it('should allow requests within quota', async () => {
      const config: QuotaConfig = {
        daily: {
          requests: 100,
          tokens: 10000,
          evaluations: 50,
        },
      };

      const result = await service.checkQuota(
        'test-id',
        AgentPattern.SEQUENTIAL_PROCESSING,
        config,
        100,
      );

      expect(result).toBe(true);
    });

    it('should block requests exceeding quota', async () => {
      const config: QuotaConfig = {
        daily: {
          requests: 2,
          tokens: 10000,
          evaluations: 50,
        },
      };

      await service.checkQuota('test-id', AgentPattern.SEQUENTIAL_PROCESSING, config);
      await service.checkQuota('test-id', AgentPattern.SEQUENTIAL_PROCESSING, config);
      const result = await service.checkQuota('test-id', AgentPattern.SEQUENTIAL_PROCESSING, config);

      expect(result).toBe(false);
      expect(eventEmitter.emit).toHaveBeenCalledWith('ratelimit.violation', expect.objectContaining({
        type: ViolationType.QUOTA_EXCEEDED,
      }));
    });

    it('should handle pattern-specific quotas', async () => {
      const config: QuotaConfig = {
        daily: {
          requests: 100,
          tokens: 10000,
          evaluations: 50,
        },
        perPattern: new Map([
          [AgentPattern.SEQUENTIAL_PROCESSING, {
            requests: 2,
            tokens: 1000,
            evaluations: 2,
          }],
        ]),
      };

      await service.checkQuota('test-id', AgentPattern.SEQUENTIAL_PROCESSING, config);
      await service.checkQuota('test-id', AgentPattern.SEQUENTIAL_PROCESSING, config);
      const result = await service.checkQuota('test-id', AgentPattern.SEQUENTIAL_PROCESSING, config);

      expect(result).toBe(false);
    });
  });

  describe('waitForRateLimit', () => {
    it('should wait and retry when rate limited', async () => {
      const config: RateLimitConfig = {
        windowMs: 100,
        maxRequests: 1,
        strategy: RateLimitStrategy.FIXED_WINDOW,
      };

      await service.checkRateLimit('test-id', config);
      
      const start = Date.now();
      await service.waitForRateLimit('test-id', config);
      const duration = Date.now() - start;

      expect(duration).toBeGreaterThanOrEqual(100);
    });

    it('should throw after max attempts', async () => {
      const config: RateLimitConfig = {
        windowMs: 60000,
        maxRequests: 1,
        strategy: RateLimitStrategy.FIXED_WINDOW,
      };

      await service.checkRateLimit('test-id', config);

      await expect(service.waitForRateLimit('test-id', config, 0)).rejects.toThrow('Rate limit exceeded after 10 attempts');
    });
  });

  describe('trackConcurrent', () => {
    it('should track concurrent operations', async () => {
      const operation = jest.fn().mockResolvedValue('result');

      const result = await service.trackConcurrent('test-id', operation, 5);

      expect(result).toBe('result');
      expect(operation).toHaveBeenCalled();
    });

    it('should block when concurrent limit exceeded', async () => {
      const state = service.getRateLimitState('test-id') || service['getOrCreateState']('test-id');
      state.concurrent = 5;

      const operation = jest.fn();

      await expect(service.trackConcurrent('test-id', operation, 5)).rejects.toThrow('Concurrent limit exceeded');
      expect(eventEmitter.emit).toHaveBeenCalledWith('ratelimit.violation', expect.objectContaining({
        type: ViolationType.CONCURRENT_LIMIT,
      }));
    });

    it('should decrement concurrent count after operation', async () => {
      const operation = jest.fn().mockResolvedValue('result');
      const state = service['getOrCreateState']('test-id');

      expect(state.concurrent).toBe(0);
      
      const promise = service.trackConcurrent('test-id', operation, 5);
      expect(state.concurrent).toBe(1);
      
      await promise;
      expect(state.concurrent).toBe(0);
    });
  });

  describe('getViolations', () => {
    it('should return all violations', async () => {
      const config: RateLimitConfig = {
        windowMs: 60000,
        maxRequests: 1,
        strategy: RateLimitStrategy.SLIDING_WINDOW,
      };

      await service.checkRateLimit('test-id', config);
      await service.checkRateLimit('test-id', config);

      const violations = service.getViolations();

      expect(violations).toHaveLength(1);
      expect(violations[0].type).toBe(ViolationType.REQUEST_LIMIT);
    });

    it('should filter violations by date', async () => {
      const config: RateLimitConfig = {
        windowMs: 60000,
        maxRequests: 1,
        strategy: RateLimitStrategy.SLIDING_WINDOW,
      };

      const beforeDate = new Date();
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await service.checkRateLimit('test-id', config);
      await service.checkRateLimit('test-id', config);

      const violations = service.getViolations(beforeDate);

      expect(violations).toHaveLength(1);
    });
  });

  describe('reset functions', () => {
    it('should reset rate limit', async () => {
      const config: RateLimitConfig = {
        windowMs: 60000,
        maxRequests: 1,
        strategy: RateLimitStrategy.SLIDING_WINDOW,
      };

      await service.checkRateLimit('test-id', config);
      service.resetRateLimit('test-id');

      const result = await service.checkRateLimit('test-id', config);
      expect(result).toBe(true);
    });

    it('should reset quota', async () => {
      const config: QuotaConfig = {
        daily: {
          requests: 1,
          tokens: 1000,
          evaluations: 1,
        },
      };

      await service.checkQuota('test-id', AgentPattern.SEQUENTIAL_PROCESSING, config);
      service.resetQuota('test-id');

      const result = await service.checkQuota('test-id', AgentPattern.SEQUENTIAL_PROCESSING, config);
      expect(result).toBe(true);
    });
  });
});