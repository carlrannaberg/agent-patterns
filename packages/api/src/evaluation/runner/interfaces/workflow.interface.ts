import { AgentPattern } from '../../enums/agent-pattern.enum';
import { TestRun } from './runner.interface';
import { BatchJob } from './batch.interface';

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  stages: WorkflowStage[];
  config: WorkflowConfig;
  status: WorkflowStatus;
  startedAt?: Date;
  completedAt?: Date;
  currentStage?: string;
  results?: WorkflowResults;
}

export interface WorkflowStage {
  id: string;
  name: string;
  type: StageType;
  config: StageConfig;
  dependencies?: string[];
  condition?: StageCondition;
  retryPolicy?: RetryPolicy;
  timeout?: number;
}

export enum StageType {
  EVALUATION = 'evaluation',
  BATCH = 'batch',
  API_TEST = 'api-test',
  VALIDATION = 'validation',
  NOTIFICATION = 'notification',
  CONDITIONAL = 'conditional',
  PARALLEL = 'parallel',
  APPROVAL = 'approval',
}

export interface StageConfig {
  patterns?: AgentPattern[];
  testSuiteIds?: string[];
  validationRules?: ValidationRule[];
  notificationConfig?: NotificationConfig;
  parallelStages?: string[];
  approvalConfig?: ApprovalConfig;
  customData?: any;
}

export interface StageCondition {
  type: ConditionType;
  expression?: string;
  threshold?: number;
  field?: string;
}

export enum ConditionType {
  ALWAYS = 'always',
  ON_SUCCESS = 'on-success',
  ON_FAILURE = 'on-failure',
  EXPRESSION = 'expression',
  THRESHOLD = 'threshold',
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffMultiplier: number;
  maxBackoff: number;
  retryableErrors?: string[];
}

export interface WorkflowConfig {
  maxDuration?: number;
  allowPartialSuccess?: boolean;
  rollbackOnFailure?: boolean;
  notifications?: WorkflowNotifications;
}

export interface WorkflowNotifications {
  onStart?: boolean;
  onComplete?: boolean;
  onFailure?: boolean;
  onStageComplete?: boolean;
  channels?: NotificationChannel[];
}

export interface NotificationChannel {
  type: 'email' | 'slack' | 'webhook';
  config: any;
}

export enum WorkflowStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  ROLLING_BACK = 'rolling-back',
}

export interface WorkflowResults {
  stages: Map<string, StageResult>;
  summary: WorkflowSummary;
  artifacts?: WorkflowArtifact[];
}

export interface StageResult {
  stageId: string;
  status: StageStatus;
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  output?: any;
  error?: any;
  retries?: number;
}

export enum StageStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
  CANCELLED = 'cancelled',
}

export interface WorkflowSummary {
  totalStages: number;
  completedStages: number;
  failedStages: number;
  skippedStages: number;
  duration: number;
  success: boolean;
}

export interface WorkflowArtifact {
  id: string;
  stageId: string;
  type: string;
  data: any;
  metadata?: any;
}

export interface ValidationRule {
  field: string;
  operator: ValidationOperator;
  value: any;
  errorMessage?: string;
}

export enum ValidationOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not-equals',
  GREATER_THAN = 'greater-than',
  LESS_THAN = 'less-than',
  CONTAINS = 'contains',
  MATCHES = 'matches',
}

export interface ApprovalConfig {
  approvers: string[];
  minApprovals: number;
  timeout: number;
  autoApproveAfterTimeout?: boolean;
}

export interface WorkflowExecution {
  workflowId: string;
  executionId: string;
  status: WorkflowStatus;
  context: WorkflowContext;
  stateManager: WorkflowStateManager;
}

export interface WorkflowContext {
  variables: Map<string, any>;
  artifacts: Map<string, any>;
  stageOutputs: Map<string, any>;
}

export interface WorkflowStateManager {
  getCurrentState(): WorkflowState;
  transition(to: string): void;
  rollback(): void;
  checkpoint(): void;
}

export interface WorkflowState {
  currentStage: string;
  completedStages: string[];
  pendingStages: string[];
  context: WorkflowContext;
  checkpoints: WorkflowCheckpoint[];
}

export interface WorkflowCheckpoint {
  id: string;
  stageId: string;
  timestamp: Date;
  state: any;
}
