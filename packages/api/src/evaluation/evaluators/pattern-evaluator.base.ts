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
      const hasReasoning = score.reasoning && score.reasoning.length > 0;
      return isValidScore && hasReasoning;
    });
  }

  protected normalizeScore(score: number, min = 0, max = 1): number {
    return Math.max(min, Math.min(max, score));
  }

  protected calculateWeightedScore(scores: MetricScore[]): number {
    // Simple average since weights are removed from MetricScore interface
    const totalScore = scores.reduce((sum, score) => sum + score.score, 0);
    return scores.length > 0 ? totalScore / scores.length : 0;
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
      metadata: {
        createdAt: new Date(),
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
