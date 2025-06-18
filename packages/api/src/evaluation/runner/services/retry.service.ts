import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  factor: number;
  jitter: boolean;
  retryCondition?: (error: any) => boolean;
  onRetry?: (error: any, attempt: number) => void;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: any;
  attempts: number;
  totalDuration: number;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  halfOpenMaxAttempts: number;
}

export enum CircuitBreakerState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half-open',
}

@Injectable()
export class RetryService {
  private readonly logger = new Logger(RetryService.name);
  private readonly circuitBreakers = new Map<string, CircuitBreaker>();

  constructor(private readonly eventEmitter: EventEmitter2) {}

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    config: Partial<RetryConfig> = {},
  ): Promise<RetryResult<T>> {
    const retryConfig: RetryConfig = {
      maxAttempts: config.maxAttempts ?? 3,
      initialDelay: config.initialDelay ?? 1000,
      maxDelay: config.maxDelay ?? 30000,
      factor: config.factor ?? 2,
      jitter: config.jitter ?? true,
      retryCondition: config.retryCondition ?? ((error) => true),
      onRetry: config.onRetry,
    };

    const startTime = Date.now();
    let lastError: any;

    for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
      try {
        const result = await operation();

        return {
          success: true,
          result,
          attempts: attempt,
          totalDuration: Date.now() - startTime,
        };
      } catch (error) {
        lastError = error;

        if (!retryConfig.retryCondition?.(error) || attempt === retryConfig.maxAttempts) {
          break;
        }

        const delay = this.calculateDelay(attempt, retryConfig);

        this.logger.debug(`Retry attempt ${attempt}/${retryConfig.maxAttempts} after ${delay}ms`);

        if (retryConfig.onRetry) {
          retryConfig.onRetry(error, attempt);
        }

        this.eventEmitter.emit('retry.attempt', {
          attempt,
          maxAttempts: retryConfig.maxAttempts,
          delay,
          error: error.message,
        });

        await this.delay(delay);
      }
    }

    return {
      success: false,
      error: lastError,
      attempts: retryConfig.maxAttempts,
      totalDuration: Date.now() - startTime,
    };
  }

  async executeWithCircuitBreaker<T>(
    key: string,
    operation: () => Promise<T>,
    config: Partial<CircuitBreakerConfig> = {},
  ): Promise<T> {
    const breaker = this.getOrCreateCircuitBreaker(key, config);

    if (breaker.state === CircuitBreakerState.OPEN) {
      if (Date.now() - breaker.lastFailureTime < breaker.config.resetTimeout) {
        throw new Error(`Circuit breaker is OPEN for ${key}`);
      }

      breaker.state = CircuitBreakerState.HALF_OPEN;
      breaker.halfOpenAttempts = 0;
    }

    try {
      const result = await operation();

      if (breaker.state === CircuitBreakerState.HALF_OPEN) {
        breaker.halfOpenAttempts++;

        if (breaker.halfOpenAttempts >= breaker.config.halfOpenMaxAttempts) {
          breaker.state = CircuitBreakerState.CLOSED;
          breaker.failures = 0;
          this.logger.log(`Circuit breaker for ${key} is now CLOSED`);
          this.eventEmitter.emit('circuitbreaker.closed', { key });
        }
      } else if (breaker.state === CircuitBreakerState.CLOSED) {
        breaker.failures = 0;
      }

      return result;
    } catch (error) {
      breaker.failures++;
      breaker.lastFailureTime = Date.now();

      if (breaker.state === CircuitBreakerState.HALF_OPEN) {
        breaker.state = CircuitBreakerState.OPEN;
        this.logger.warn(`Circuit breaker for ${key} reopened after half-open failure`);
        this.eventEmitter.emit('circuitbreaker.opened', { key, reason: 'half-open-failure' });
      } else if (breaker.failures >= breaker.config.failureThreshold) {
        breaker.state = CircuitBreakerState.OPEN;
        this.logger.warn(`Circuit breaker for ${key} opened after ${breaker.failures} failures`);
        this.eventEmitter.emit('circuitbreaker.opened', { key, reason: 'threshold-exceeded' });
      }

      throw error;
    }
  }

  async retryWithBackoff<T>(
    operation: () => Promise<T>,
    options: {
      maxRetries?: number;
      baseDelay?: number;
      maxDelay?: number;
      shouldRetry?: (error: any, attempt: number) => boolean;
    } = {},
  ): Promise<T> {
    const maxRetries = options.maxRetries ?? 3;
    const baseDelay = options.baseDelay ?? 1000;
    const maxDelay = options.maxDelay ?? 60000;
    const shouldRetry = options.shouldRetry ?? (() => true);

    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (attempt === maxRetries || !shouldRetry(error, attempt)) {
          throw error;
        }

        const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
        const jitteredDelay = delay + Math.random() * delay * 0.1;

        this.logger.debug(
          `Retrying after ${jitteredDelay}ms (attempt ${attempt + 1}/${maxRetries})`,
        );
        await this.delay(jitteredDelay);
      }
    }

    throw lastError;
  }

  createRetryableOperation<T>(
    operation: () => Promise<T>,
    config?: Partial<RetryConfig>,
  ): () => Promise<T> {
    return async () => {
      const result = await this.executeWithRetry(operation, config);
      if (!result.success) {
        throw result.error;
      }
      return result.result!;
    };
  }

  getCircuitBreakerState(key: string): CircuitBreakerState | undefined {
    const breaker = this.circuitBreakers.get(key);
    return breaker?.state;
  }

  resetCircuitBreaker(key: string): void {
    const breaker = this.circuitBreakers.get(key);
    if (breaker) {
      breaker.state = CircuitBreakerState.CLOSED;
      breaker.failures = 0;
      this.logger.log(`Circuit breaker for ${key} manually reset`);
      this.eventEmitter.emit('circuitbreaker.reset', { key });
    }
  }

  private calculateDelay(attempt: number, config: RetryConfig): number {
    let delay = Math.min(
      config.initialDelay * Math.pow(config.factor, attempt - 1),
      config.maxDelay,
    );

    if (config.jitter) {
      const jitter = delay * 0.1 * (Math.random() - 0.5);
      delay += jitter;
    }

    return Math.round(delay);
  }

  private getOrCreateCircuitBreaker(
    key: string,
    config: Partial<CircuitBreakerConfig>,
  ): CircuitBreaker {
    let breaker = this.circuitBreakers.get(key);

    if (!breaker) {
      breaker = {
        state: CircuitBreakerState.CLOSED,
        failures: 0,
        lastFailureTime: 0,
        halfOpenAttempts: 0,
        config: {
          failureThreshold: config.failureThreshold ?? 5,
          resetTimeout: config.resetTimeout ?? 60000,
          halfOpenMaxAttempts: config.halfOpenMaxAttempts ?? 3,
        },
      };
      this.circuitBreakers.set(key, breaker);
    }

    return breaker;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

interface CircuitBreaker {
  state: CircuitBreakerState;
  failures: number;
  lastFailureTime: number;
  halfOpenAttempts: number;
  config: CircuitBreakerConfig;
}
