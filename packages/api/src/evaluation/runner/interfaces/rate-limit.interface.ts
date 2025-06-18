export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  maxTokens?: number;
  maxConcurrent?: number;
  strategy: RateLimitStrategy;
}

export enum RateLimitStrategy {
  SLIDING_WINDOW = 'sliding-window',
  FIXED_WINDOW = 'fixed-window',
  TOKEN_BUCKET = 'token-bucket',
  LEAKY_BUCKET = 'leaky-bucket',
}

export interface QuotaConfig {
  daily: QuotaLimit;
  hourly?: QuotaLimit;
  monthly?: QuotaLimit;
  perPattern?: Map<string, QuotaLimit>;
}

export interface QuotaLimit {
  requests: number;
  tokens: number;
  evaluations: number;
}

export interface RateLimitState {
  requests: number;
  tokens: number;
  concurrent: number;
  windowStart: Date;
  lastRequest: Date;
  violations: number;
}

export interface QuotaUsage {
  period: QuotaPeriod;
  requests: number;
  tokens: number;
  evaluations: number;
  remaining: QuotaLimit;
  resetAt: Date;
}

export enum QuotaPeriod {
  HOURLY = 'hourly',
  DAILY = 'daily',
  MONTHLY = 'monthly',
}

export interface RateLimitViolation {
  timestamp: Date;
  type: ViolationType;
  limit: number;
  attempted: number;
  pattern?: string;
  metadata?: any;
}

export enum ViolationType {
  REQUEST_LIMIT = 'request-limit',
  TOKEN_LIMIT = 'token-limit',
  CONCURRENT_LIMIT = 'concurrent-limit',
  QUOTA_EXCEEDED = 'quota-exceeded',
}

export interface AdaptiveRateLimitConfig {
  enabled: boolean;
  minRequests: number;
  maxRequests: number;
  adjustmentFactor: number;
  errorThreshold: number;
  successThreshold: number;
  adjustmentInterval: number;
}