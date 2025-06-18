import { AgentPattern } from '../../enums/agent-pattern.enum';
import { TestRun } from './runner.interface';

export interface BatchJob {
  id: string;
  name: string;
  description?: string;
  patterns: AgentPattern[];
  testSuiteIds: string[];
  config: BatchConfig;
  status: BatchJobStatus;
  progress: BatchProgress;
  results?: BatchResults;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  scheduledFor?: Date;
}

export interface BatchConfig {
  parallel: boolean;
  maxConcurrency: number;
  prioritization: PrioritizationStrategy;
  errorHandling: ErrorHandlingStrategy;
  notifications?: NotificationConfig;
  resourceLimits?: ResourceLimits;
}

export enum PrioritizationStrategy {
  FIFO = 'fifo',
  LIFO = 'lifo',
  PRIORITY = 'priority',
  ROUND_ROBIN = 'round-robin',
}

export enum ErrorHandlingStrategy {
  FAIL_FAST = 'fail-fast',
  CONTINUE = 'continue',
  RETRY_FAILED = 'retry-failed',
}

export interface NotificationConfig {
  onStart?: boolean;
  onComplete?: boolean;
  onError?: boolean;
  webhookUrl?: string;
  emailRecipients?: string[];
}

export interface ResourceLimits {
  maxMemoryMB?: number;
  maxCpuPercent?: number;
  maxDurationMinutes?: number;
}

export enum BatchJobStatus {
  PENDING = 'pending',
  QUEUED = 'queued',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  PARTIALLY_COMPLETED = 'partially-completed',
}

export interface BatchProgress {
  totalTests: number;
  completedTests: number;
  failedTests: number;
  skippedTests: number;
  percentComplete: number;
  estimatedTimeRemaining?: number;
  currentPattern?: AgentPattern;
  currentTest?: string;
}

export interface BatchResults {
  testRuns: TestRun[];
  summary: BatchSummary;
  patternResults: Map<AgentPattern, PatternBatchResult>;
  errors: BatchError[];
  performance: BatchPerformance;
}

export interface BatchSummary {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  errorTests: number;
  skippedTests: number;
  successRate: number;
  averageScore: number;
  duration: number;
}

export interface PatternBatchResult {
  pattern: AgentPattern;
  testsRun: number;
  testsPassed: number;
  testsFailed: number;
  averageScore: number;
  averageLatency: number;
  errors: string[];
}

export interface BatchError {
  timestamp: Date;
  pattern?: AgentPattern;
  testId?: string;
  error: string;
  stack?: string;
  severity: 'warning' | 'error' | 'critical';
}

export interface BatchPerformance {
  startTime: Date;
  endTime: Date;
  totalDuration: number;
  averageTestDuration: number;
  testsPerMinute: number;
  tokenUsage: {
    total: number;
    byPattern: Map<AgentPattern, number>;
  };
  apiCalls: {
    total: number;
    byPattern: Map<AgentPattern, number>;
  };
}