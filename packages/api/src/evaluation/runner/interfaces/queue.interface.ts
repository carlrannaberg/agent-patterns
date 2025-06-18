import { AgentPattern } from '../../enums/agent-pattern.enum';
import { TestRun } from './runner.interface';
import { BatchJob } from './batch.interface';

export interface EvaluationJob {
  id: string;
  type: JobType;
  priority: JobPriority;
  data: JobData;
  options?: JobOptions;
  status?: JobStatus;
  progress?: number;
  result?: any;
  error?: any;
  attempts?: number;
  createdAt?: Date;
  processedAt?: Date;
  completedAt?: Date;
}

export enum JobType {
  SINGLE_EVALUATION = 'single-evaluation',
  BATCH_EVALUATION = 'batch-evaluation',
  API_TEST = 'api-test',
  SCHEDULED_EVALUATION = 'scheduled-evaluation',
  CALIBRATION = 'calibration',
  GOLD_DATASET_UPDATE = 'gold-dataset-update',
}

export enum JobPriority {
  LOW = 10,
  NORMAL = 0,
  HIGH = -5,
  CRITICAL = -10,
}

export enum JobStatus {
  WAITING = 'waiting',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  FAILED = 'failed',
  DELAYED = 'delayed',
  PAUSED = 'paused',
}

export interface JobData {
  pattern?: AgentPattern;
  patterns?: AgentPattern[];
  input?: any;
  testSuiteId?: string;
  batchJobId?: string;
  scheduleId?: string;
  metadata?: Record<string, any>;
}

export interface JobOptions {
  delay?: number;
  attempts?: number;
  backoff?: BackoffOptions;
  removeOnComplete?: boolean;
  removeOnFail?: boolean;
  timeout?: number;
}

export interface BackoffOptions {
  type: 'fixed' | 'exponential';
  delay: number;
}

export interface QueueMetrics {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
  totalProcessed: number;
  averageProcessingTime: number;
  throughput: {
    minute: number;
    hour: number;
    day: number;
  };
}

export interface QueueEvents {
  onActive?: (job: EvaluationJob) => void;
  onProgress?: (job: EvaluationJob, progress: number) => void;
  onCompleted?: (job: EvaluationJob, result: any) => void;
  onFailed?: (job: EvaluationJob, error: any) => void;
  onStalled?: (job: EvaluationJob) => void;
}

export interface DeadLetterQueue {
  jobs: FailedJob[];
  maxSize: number;
  retentionPeriod: number;
}

export interface FailedJob {
  job: EvaluationJob;
  error: any;
  failedAt: Date;
  attempts: number;
  canRetry: boolean;
}
