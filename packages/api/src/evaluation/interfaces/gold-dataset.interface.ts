import { AgentPattern } from '../enums/agent-pattern.enum';

export interface GoldSample {
  id: string;
  pattern: AgentPattern;
  version: string;
  createdAt: Date;
  input: {
    content: string;
    context?: Record<string, any>;
  };
  expectedOutput?: {
    content: string;
    metadata?: Record<string, any>;
  };
  humanScores: HumanScore[];
  complexity: 'low' | 'medium' | 'high';
  edgeCase: boolean;
  tags: string[];
}

export interface HumanScore {
  evaluatorId: string;
  timestamp: Date;
  scores: {
    overall: number;
    [dimension: string]: number;
  };
  comments?: string;
  timeSpent: number; // in seconds
}

export interface GoldDatasetMetadata {
  version: string;
  createdAt: Date;
  lastUpdated: Date;
  pattern: AgentPattern;
  sampleCount: number;
  humanEvaluatorCount: number;
  averageInterRaterAgreement: number;
  complexityDistribution: {
    low: number;
    medium: number;
    high: number;
  };
}

export interface CalibrationResult {
  timestamp: Date;
  pattern: AgentPattern;
  weights: Record<string, number>;
  spearmanCorrelation: number;
  krippendorffAlpha: number;
  confidenceInterval: {
    lower: number;
    upper: number;
  };
  validationMetrics: {
    mse: number;
    mae: number;
    bias: number;
  };
}