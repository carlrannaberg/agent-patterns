import { AgentPattern } from '../enums/agent-pattern.enum';
import { JudgeModel } from '../enums/judge-model.enum';

export interface EvaluationMetric {
  name: string;
  description: string;
  scoreRange: [number, number];
  weight?: number;
  binaryCheck?: boolean;
}

export interface EvaluationConfig {
  pattern: AgentPattern;
  judgeModel: JudgeModel;
  metrics: EvaluationMetric[];
  temperature?: number;
  maxRetries?: number;
  timeoutMs?: number;
  batchSize?: number;
  sampleSize?: number;
  rubricPath?: string;
  enableBiasmitigaation?: boolean;
  enableReliabilityChecks?: boolean;
}

export interface TestCase {
  id: string;
  pattern: AgentPattern;
  input: any;
  expectedOutput?: any;
  context?: Record<string, any>;
  metadata?: {
    difficulty?: 'easy' | 'medium' | 'hard';
    category?: string;
    tags?: string[];
    createdAt?: Date;
    updatedAt?: Date;
    expectedTaskCount?: number;
    expectedIssues?: string[];
    expectedDepartment?: string;
    expectedAnswer?: number | string;
    [key: string]: any;
  };
}

export interface MetricScore {
  metric: string;
  score: number;
  normalizedScore: number;
  reasoning?: string;
  confidence?: number;
  details?: Record<string, any>;
}

export interface EvaluationResult {
  testCaseId: string;
  pattern: AgentPattern;
  judgeModel: JudgeModel;
  metricScores: MetricScore[];
  overallScore: number;
  pass: boolean;
  executionTimeMs: number;
  timestamp: Date;
  error?: string;
  details?: EvaluationDetails;
}

export interface EvaluationDetails {
  actualOutput: any;
  expectedOutput?: any;
  chainOfThought?: string[];
  rubricSteps?: RubricStep[];
  biasChecks?: BiasCheck[];
  reliabilityMetrics?: ReliabilityMetrics;
  evaluationMethod?: string;
}

export interface RubricStep {
  step: number;
  description: string;
  evaluation: string;
  score: number;
}

export interface BiasCheck {
  type: 'position' | 'length' | 'format';
  passed: boolean;
  details: string;
}

export interface ReliabilityMetrics {
  krippendorffsAlpha?: number;
  interRaterAgreement?: number;
  confidenceInterval?: [number, number];
  sampleSize: number;
}

export interface EvaluationBatch {
  batchId: string;
  pattern: AgentPattern;
  testCases: TestCase[];
  config: EvaluationConfig;
  results: EvaluationResult[];
  summary: BatchSummary;
  createdAt: Date;
  completedAt?: Date;
}

export interface BatchSummary {
  totalTestCases: number;
  passedTestCases: number;
  failedTestCases: number;
  averageScore: number;
  metricAverages: Record<string, number>;
  executionTimeMs: number;
  reliabilityMetrics?: ReliabilityMetrics;
}
