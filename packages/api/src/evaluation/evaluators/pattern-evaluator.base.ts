import { Injectable } from '@nestjs/common';
import { AgentPattern } from '../enums/agent-pattern.enum';
import {
  TestCase,
  EvaluationResult,
  EvaluationConfig,
  MetricScore,
} from '../interfaces/evaluation.interface';

export interface PatternEvaluator {
  pattern: AgentPattern;
  generateTestCases(count: number, complexity?: 'simple' | 'moderate' | 'complex'): TestCase[];
  evaluateResponse(
    testCase: TestCase,
    response: any,
    config: EvaluationConfig,
  ): Promise<EvaluationResult>;
  validateMetrics(scores: MetricScore[]): boolean;
  getEvaluationPrompt(metric: string, testCase: TestCase, response: any): string;
}

@Injectable()
export abstract class PatternEvaluatorBase implements PatternEvaluator {
  abstract pattern: AgentPattern;

  abstract generateTestCases(
    count: number,
    complexity?: 'simple' | 'moderate' | 'complex',
  ): TestCase[];

  abstract evaluateResponse(
    testCase: TestCase,
    response: any,
    config: EvaluationConfig,
  ): Promise<EvaluationResult>;

  abstract getEvaluationPrompt(metric: string, testCase: TestCase, response: any): string;

  validateMetrics(scores: MetricScore[]): boolean {
    return scores.every((score) => {
      const isValidScore = score.score >= 0 && score.score <= 1;
      const hasRationale = score.rationale && score.rationale.length > 0;
      return isValidScore && hasRationale;
    });
  }

  protected normalizeScore(score: number, min = 0, max = 1): number {
    return Math.max(min, Math.min(max, score));
  }

  protected calculateWeightedScore(scores: MetricScore[]): number {
    const totalWeight = scores.reduce((sum, score) => sum + (score.weight || 1), 0);
    const weightedSum = scores.reduce((sum, score) => sum + score.score * (score.weight || 1), 0);
    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  protected generateBaseTestCase(
    pattern: AgentPattern,
    input: any,
    expectedBehavior: string[],
    metadata?: Record<string, any>,
  ): TestCase {
    return {
      id: `${pattern}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      pattern,
      input,
      expectedBehavior,
      metadata: {
        createdAt: new Date().toISOString(),
        complexity: metadata?.complexity || 'moderate',
        ...metadata,
      },
    };
  }

  protected getComplexityMultiplier(complexity?: 'simple' | 'moderate' | 'complex'): number {
    switch (complexity) {
      case 'simple':
        return 0.7;
      case 'complex':
        return 1.3;
      default:
        return 1.0;
    }
  }
}
