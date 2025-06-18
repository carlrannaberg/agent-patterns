import { BatchJob } from './batch.interface';
import { AgentPattern } from '../../enums/agent-pattern.enum';

export interface ScheduledEvaluation {
  id: string;
  name: string;
  description?: string;
  schedule: ScheduleConfig;
  evaluation: EvaluationConfig;
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  history: ScheduleHistory[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ScheduleConfig {
  type: ScheduleType;
  cronExpression?: string;
  interval?: number;
  dayOfWeek?: number;
  hour?: number;
  minute?: number;
  timezone?: string;
}

export enum ScheduleType {
  CRON = 'cron',
  INTERVAL = 'interval',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

export interface EvaluationConfig {
  patterns: AgentPattern[];
  testSuiteIds: string[];
  batchConfig?: any;
  notifications?: ScheduleNotifications;
}

export interface ScheduleNotifications {
  onSuccess?: boolean;
  onFailure?: boolean;
  onStart?: boolean;
  webhookUrl?: string;
  emailRecipients?: string[];
  slackChannel?: string;
}

export interface ScheduleHistory {
  runId: string;
  batchJobId: string;
  startedAt: Date;
  completedAt?: Date;
  status: ScheduleRunStatus;
  summary?: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    duration: number;
  };
  error?: string;
}

export enum ScheduleRunStatus {
  SUCCESS = 'success',
  FAILURE = 'failure',
  PARTIAL = 'partial',
  CANCELLED = 'cancelled',
  ERROR = 'error',
}

export interface ScheduleJobOptions {
  scheduleId: string;
  immediate?: boolean;
  skipIfRunning?: boolean;
}
