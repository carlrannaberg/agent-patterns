import { AgentPattern } from '../../enums/agent-pattern.enum';

export interface PerformanceMetrics {
  timestamp: Date;
  pattern: AgentPattern;
  operation: MetricOperation;
  duration: number;
  success: boolean;
  metadata?: Record<string, any>;
}

export enum MetricOperation {
  EVALUATION = 'evaluation',
  TEST_RUN = 'test-run',
  BATCH_JOB = 'batch-job',
  API_CALL = 'api-call',
  CACHE_HIT = 'cache-hit',
  CACHE_MISS = 'cache-miss',
  QUEUE_JOB = 'queue-job',
}

export interface TokenUsageMetrics {
  pattern: AgentPattern;
  timestamp: Date;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost?: number;
  model?: string;
}

export interface SystemMetrics {
  timestamp: Date;
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  evaluations: {
    active: number;
    queued: number;
    completed: number;
    failed: number;
  };
}

export interface AggregatedMetrics {
  period: MetricPeriod;
  startTime: Date;
  endTime: Date;
  patterns: Map<AgentPattern, PatternMetrics>;
  totals: TotalMetrics;
  system: SystemHealthMetrics;
}

export enum MetricPeriod {
  MINUTE = 'minute',
  HOUR = 'hour',
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
}

export interface PatternMetrics {
  pattern: AgentPattern;
  evaluations: {
    total: number;
    successful: number;
    failed: number;
    avgDuration: number;
    p95Duration: number;
    p99Duration: number;
  };
  tokens: {
    total: number;
    avgPerEvaluation: number;
    cost: number;
  };
  cache: {
    hits: number;
    misses: number;
    hitRate: number;
  };
  errors: ErrorMetrics[];
}

export interface TotalMetrics {
  evaluations: number;
  successRate: number;
  avgDuration: number;
  totalTokens: number;
  totalCost: number;
  throughput: {
    evaluationsPerMinute: number;
    tokensPerMinute: number;
  };
}

export interface SystemHealthMetrics {
  uptime: number;
  avgCpuUsage: number;
  avgMemoryUsage: number;
  peakCpuUsage: number;
  peakMemoryUsage: number;
  queueHealth: {
    avgWaitTime: number;
    maxWaitTime: number;
    deadLetterCount: number;
  };
}

export interface ErrorMetrics {
  timestamp: Date;
  pattern?: AgentPattern;
  errorType: string;
  count: number;
  message: string;
  stack?: string;
}

export interface MetricAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  pattern?: AgentPattern;
  metric: string;
  threshold: number;
  currentValue: number;
  message: string;
  timestamp: Date;
  resolved?: boolean;
}

export enum AlertType {
  ERROR_RATE = 'error-rate',
  LATENCY = 'latency',
  TOKEN_USAGE = 'token-usage',
  SYSTEM_RESOURCE = 'system-resource',
  QUEUE_BACKUP = 'queue-backup',
  CACHE_MISS_RATE = 'cache-miss-rate',
}

export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}