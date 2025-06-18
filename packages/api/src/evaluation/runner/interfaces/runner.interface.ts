import { AgentPattern } from '../../enums/agent-pattern.enum';
import { EvaluationResult } from '../../interfaces/evaluation.interface';

export interface TestSuite {
  id: string;
  name: string;
  description: string;
  patterns: AgentPattern[];
  testCases: TestCase[];
  config: TestSuiteConfig;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestCase {
  id: string;
  pattern: AgentPattern;
  input: any;
  expectedOutput?: any;
  metadata?: Record<string, any>;
  timeout?: number;
}

export interface TestSuiteConfig {
  parallel: boolean;
  maxConcurrency?: number;
  retryAttempts?: number;
  retryDelay?: number;
  timeout?: number;
  rateLimit?: RateLimitConfig;
  cache?: CacheConfig;
}

export interface RateLimitConfig {
  maxRequestsPerMinute: number;
  maxTokensPerMinute: number;
  burstLimit?: number;
}

export interface CacheConfig {
  enabled: boolean;
  ttl: number;
  keyPrefix?: string;
}

export interface TestRunOptions {
  suiteId?: string;
  patterns?: AgentPattern[];
  tags?: string[];
  parallel?: boolean;
  dryRun?: boolean;
  verbose?: boolean;
}

export interface TestRun {
  id: string;
  suiteId: string;
  status: TestRunStatus;
  results: TestRunResult[];
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  metadata?: Record<string, any>;
}

export enum TestRunStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export interface TestRunResult {
  testCaseId: string;
  pattern: AgentPattern;
  status: TestResultStatus;
  evaluationResult?: EvaluationResult;
  error?: TestError;
  startedAt: Date;
  completedAt: Date;
  duration: number;
  retryCount: number;
}

export enum TestResultStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  PASSED = 'passed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
  ERROR = 'error',
}

export interface TestError {
  code: string;
  message: string;
  stack?: string;
  details?: any;
}

export interface TestRunner {
  run(options: TestRunOptions): Promise<TestRun>;
  cancel(runId: string): Promise<void>;
  getStatus(runId: string): Promise<TestRun>;
}
