import { Injectable, Logger } from '@nestjs/common';
import {
  EvaluationConfig,
  EvaluationResult,
  TestCase,
  EvaluationBatch,
  BatchSummary,
  MetricScore,
} from '../interfaces/evaluation.interface';
import { AgentPattern } from '../enums/agent-pattern.enum';
import { LlmJudgeService } from './llm-judge.service';
import { GEvalService } from './g-eval.service';
import { TestCaseService } from './test-case.service';
import { ReliabilityService } from './reliability.service';
import { EvaluationConfigService } from './evaluation-config.service';

@Injectable()
export class EvaluationService {
  private readonly logger = new Logger(EvaluationService.name);

  constructor(
    private readonly llmJudgeService: LlmJudgeService,
    private readonly gEvalService: GEvalService,
    private readonly testCaseService: TestCaseService,
    private readonly reliabilityService: ReliabilityService,
    private readonly configService: EvaluationConfigService,
  ) {}

  async evaluateSingle(
    testCase: TestCase,
    actualOutput: any,
    config?: Partial<EvaluationConfig>,
  ): Promise<EvaluationResult> {
    const startTime = Date.now();
    const fullConfig = this.configService.getConfig(testCase.pattern, config);

    try {
      this.logger.log(
        `Starting evaluation for test case ${testCase.id} with pattern ${testCase.pattern}`,
      );

      // Choose evaluation method based on configuration
      const evaluationMethod = fullConfig.rubricPath ? 'g-eval' : 'standard';
      let metricScores: MetricScore[];
      let details: any = {};

      if (evaluationMethod === 'g-eval') {
        // Use G-Eval methodology
        metricScores = await this.evaluateWithGEval(testCase, actualOutput, fullConfig);
        details.evaluationMethod = 'G-Eval';
      } else {
        // Use standard LLM judge
        const result = await this.llmJudgeService.evaluate(testCase, actualOutput, fullConfig);
        metricScores = result.metricScores;
        details = result.details;
        details.evaluationMethod = 'Standard LLM Judge';
      }

      // Calculate overall score
      const overallScore = this.calculateOverallScore(metricScores, fullConfig);

      // Determine pass/fail
      const pass = this.determinePass(metricScores, overallScore, fullConfig);

      const result: EvaluationResult = {
        testCaseId: testCase.id,
        pattern: testCase.pattern,
        judgeModel: fullConfig.judgeModel,
        metricScores,
        overallScore,
        pass,
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date(),
        details,
      };

      this.logger.log(
        `Evaluation completed for test case ${testCase.id}: ${
          pass ? 'PASS' : 'FAIL'
        } (score: ${overallScore.toFixed(2)})`,
      );

      return result;
    } catch (error) {
      this.logger.error(`Evaluation failed for test case ${testCase.id}:`, error);

      return {
        testCaseId: testCase.id,
        pattern: testCase.pattern,
        judgeModel: fullConfig.judgeModel,
        metricScores: [],
        overallScore: 0,
        pass: false,
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async evaluateBatch(
    pattern: AgentPattern,
    testCases: TestCase[],
    actualOutputs: Map<string, any>,
    config?: Partial<EvaluationConfig>,
  ): Promise<EvaluationBatch> {
    const batchId = this.generateBatchId();
    const fullConfig = this.configService.getConfig(pattern, config);
    const batchStartTime = Date.now();

    this.logger.log(`Starting batch evaluation ${batchId} for ${testCases.length} test cases`);

    const results: EvaluationResult[] = [];
    const batchSize = fullConfig.batchSize || 5;

    // Process in batches to avoid overwhelming the system
    for (let i = 0; i < testCases.length; i += batchSize) {
      const batch = testCases.slice(i, i + batchSize);

      const batchResults = await Promise.all(
        batch.map(async (testCase) => {
          const actualOutput = actualOutputs.get(testCase.id);
          if (!actualOutput) {
            this.logger.warn(`No actual output found for test case ${testCase.id}`);
            return null;
          }

          return this.evaluateSingle(testCase, actualOutput, config);
        }),
      );

      results.push(...batchResults.filter((r): r is EvaluationResult => r !== null));

      // Log progress
      this.logger.log(
        `Batch evaluation progress: ${Math.min(
          i + batchSize,
          testCases.length,
        )}/${testCases.length}`,
      );
    }

    // Calculate reliability metrics if enabled
    let reliabilityMetrics;
    if (fullConfig.enableReliabilityChecks && results.length > 1) {
      reliabilityMetrics = await this.reliabilityService.calculateReliability(results);
    }

    // Generate summary
    const summary = this.generateBatchSummary(
      results,
      Date.now() - batchStartTime,
      reliabilityMetrics,
    );

    const batch: EvaluationBatch = {
      batchId,
      pattern,
      testCases,
      config: fullConfig,
      results,
      summary,
      createdAt: new Date(batchStartTime),
      completedAt: new Date(),
    };

    this.logger.log(
      `Batch evaluation ${batchId} completed: ${summary.passedTestCases}/${
        summary.totalTestCases
      } passed (avg score: ${summary.averageScore.toFixed(2)})`,
    );

    return batch;
  }

  async evaluatePattern(
    pattern: AgentPattern,
    executionFunction: (input: any) => Promise<any>,
    options?: {
      testCaseLimit?: number;
      config?: Partial<EvaluationConfig>;
      testCaseFilter?: {
        difficulty?: 'easy' | 'medium' | 'hard';
        category?: string;
        tags?: string[];
      };
    },
  ): Promise<EvaluationBatch> {
    // Get test cases for the pattern
    const testCases = await this.testCaseService.getTestCasesByPattern(pattern, {
      ...options?.testCaseFilter,
      limit: options?.testCaseLimit,
      random: true,
    });

    if (testCases.length === 0) {
      throw new Error(`No test cases found for pattern ${pattern}`);
    }

    this.logger.log(`Evaluating pattern ${pattern} with ${testCases.length} test cases`);

    // Execute the pattern for each test case
    const actualOutputs = new Map<string, any>();

    for (const testCase of testCases) {
      try {
        const output = await executionFunction(testCase.input);
        actualOutputs.set(testCase.id, output);
      } catch (error) {
        this.logger.error(`Failed to execute pattern for test case ${testCase.id}:`, error);
        actualOutputs.set(testCase.id, {
          error: error instanceof Error ? error.message : 'Execution failed',
        });
      }
    }

    // Evaluate all results
    return this.evaluateBatch(pattern, testCases, actualOutputs, options?.config);
  }

  private async evaluateWithGEval(
    testCase: TestCase,
    actualOutput: any,
    config: EvaluationConfig,
  ): Promise<MetricScore[]> {
    const metricScores: MetricScore[] = [];

    for (const metric of config.metrics) {
      const score = await this.gEvalService.evaluateWithGEval(
        testCase,
        actualOutput,
        metric.name,
        config,
      );
      metricScores.push(score);
    }

    return metricScores;
  }

  private calculateOverallScore(metricScores: MetricScore[], config: EvaluationConfig): number {
    if (metricScores.length === 0) return 0;

    // Calculate weighted average if weights are provided
    const totalWeight = config.metrics.reduce((sum, metric) => sum + (metric.weight || 1), 0);

    const weightedSum = metricScores.reduce((sum, score) => {
      const metric = config.metrics.find((m) => m.name === score.metric);
      const weight = metric?.weight || 1;
      return sum + score.normalizedScore * weight;
    }, 0);

    return weightedSum / totalWeight;
  }

  private determinePass(
    metricScores: MetricScore[],
    overallScore: number,
    config: EvaluationConfig,
  ): boolean {
    // Check if all binary checks pass
    const binaryChecks = config.metrics.filter((m) => m.binaryCheck);
    for (const check of binaryChecks) {
      const score = metricScores.find((s) => s.metric === check.name);
      if (!score || score.normalizedScore < 0.5) {
        return false;
      }
    }

    // Check overall score threshold (default 0.7)
    const threshold = config.metrics[0]?.scoreRange[1] * 0.7 || 0.7;
    return overallScore >= threshold / config.metrics[0]?.scoreRange[1];
  }

  private generateBatchSummary(
    results: EvaluationResult[],
    executionTimeMs: number,
    reliabilityMetrics?: any,
  ): BatchSummary {
    const passedTestCases = results.filter((r) => r.pass).length;
    const averageScore = results.reduce((sum, r) => sum + r.overallScore, 0) / results.length;

    // Calculate metric averages
    const metricAverages: Record<string, number> = {};
    const metricCounts: Record<string, number> = {};

    results.forEach((result) => {
      result.metricScores.forEach((score) => {
        metricAverages[score.metric] = (metricAverages[score.metric] || 0) + score.normalizedScore;
        metricCounts[score.metric] = (metricCounts[score.metric] || 0) + 1;
      });
    });

    // Average the metrics
    Object.keys(metricAverages).forEach((metric) => {
      metricAverages[metric] /= metricCounts[metric];
    });

    return {
      totalTestCases: results.length,
      passedTestCases,
      failedTestCases: results.length - passedTestCases,
      averageScore,
      metricAverages,
      executionTimeMs,
      reliabilityMetrics,
    };
  }

  private generateBatchId(): string {
    return `batch-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }
}
