import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Between, LessThan, MoreThan } from 'typeorm';
import { EvaluationResult, EvaluationBatch, MetricScore } from '../../database/entities';
import {
  EvaluationResult as IEvaluationResult,
  EvaluationBatch as IEvaluationBatch,
  TestCase,
} from '../interfaces/evaluation.interface';

@Injectable()
export class ResultsStorageService {
  private readonly logger = new Logger(ResultsStorageService.name);

  constructor(
    @InjectRepository(EvaluationResult)
    private evaluationResultRepo: Repository<EvaluationResult>,
    @InjectRepository(EvaluationBatch)
    private evaluationBatchRepo: Repository<EvaluationBatch>,
    @InjectRepository(MetricScore)
    private metricScoreRepo: Repository<MetricScore>,
  ) {}

  async saveEvaluationResult(
    result: IEvaluationResult,
    batchId?: string,
  ): Promise<EvaluationResult> {
    const entity = this.evaluationResultRepo.create({
      patternType: result.pattern,
      testCaseId: result.testCaseId,
      input: result.details?.actualOutput || {},
      output: result.details?.actualOutput || {},
      overallScore: result.overallScore,
      metadata: result.details || {},
      error: result.error,
      success: result.pass,
      executionTimeMs: result.executionTimeMs,
      llmMetadata: {},
      evaluationMethod: result.details?.evaluationMethod || 'unknown',
      evaluatorConfig: {},
      batchId,
    });

    const savedResult = await this.evaluationResultRepo.save(entity);

    if (result.metricScores && result.metricScores.length > 0) {
      const metricEntities = result.metricScores.map((metric) =>
        this.metricScoreRepo.create({
          name: metric.metric,
          score: metric.normalizedScore,
          weight: 1,
          feedback: metric.reasoning || '',
          details: metric.details || {},
          evaluationResultId: savedResult.id,
        }),
      );

      await this.metricScoreRepo.save(metricEntities);
    }

    const response = await this.evaluationResultRepo.findOne({
      where: { id: savedResult.id },
      relations: ['metrics'],
    });
    if (!response) {
      throw new Error(`Evaluation result with id ${savedResult.id} not found after save`);
    }
    return response;
  }

  async saveBatchResults(
    batch: IEvaluationBatch,
    results: IEvaluationResult[],
  ): Promise<EvaluationBatch> {
    const batchEntity = this.evaluationBatchRepo.create({
      patternType: batch.pattern,
      status: 'running',
      totalTests: results.length,
      configuration: batch.config,
      description: 'Evaluation batch',
      startedAt: new Date(),
    });

    const savedBatch = await this.evaluationBatchRepo.save(batchEntity);

    let completedTests = 0;
    let failedTests = 0;
    let totalScore = 0;

    for (const result of results) {
      try {
        await this.saveEvaluationResult(result, savedBatch.id);
        completedTests++;
        if (!result.pass) {
          failedTests++;
        }
        totalScore += result.overallScore;
      } catch (error) {
        this.logger.error(`Failed to save evaluation result: ${error.message}`);
        failedTests++;
      }
    }

    const averageScore = completedTests > 0 ? totalScore / completedTests : 0;

    const summary = await this.calculateBatchSummary(savedBatch.id);

    await this.evaluationBatchRepo.update(savedBatch.id, {
      status: 'completed',
      completedTests,
      failedTests,
      averageScore,
      summary,
      completedAt: new Date(),
    });

    const updatedBatch = await this.evaluationBatchRepo.findOne({
      where: { id: savedBatch.id },
      relations: ['results', 'results.metrics'],
    });
    if (!updatedBatch) {
      throw new Error(`Batch with id ${savedBatch.id} not found`);
    }
    return updatedBatch;
  }

  async getEvaluationResult(id: string): Promise<EvaluationResult> {
    const result = await this.evaluationResultRepo.findOne({
      where: { id },
      relations: ['metrics', 'batch'],
    });
    if (!result) {
      throw new Error(`Evaluation result with id ${id} not found`);
    }
    return result;
  }

  async getEvaluationBatch(id: string): Promise<EvaluationBatch> {
    const batch = await this.evaluationBatchRepo.findOne({
      where: { id },
      relations: ['results', 'results.metrics'],
    });
    if (!batch) {
      throw new Error(`Evaluation batch with id ${id} not found`);
    }
    return batch;
  }

  async queryEvaluationResults(options: {
    patternType?: string;
    testCaseId?: string;
    batchId?: string;
    startDate?: Date;
    endDate?: Date;
    minScore?: number;
    maxScore?: number;
    success?: boolean;
    limit?: number;
    offset?: number;
    orderBy?: 'createdAt' | 'overallScore';
    orderDirection?: 'ASC' | 'DESC';
  }): Promise<{ results: EvaluationResult[]; total: number }> {
    const where: FindOptionsWhere<EvaluationResult> = {};

    if (options.patternType) where.patternType = options.patternType;
    if (options.testCaseId) where.testCaseId = options.testCaseId;
    if (options.batchId) where.batchId = options.batchId;
    if (options.success !== undefined) where.success = options.success;

    if (options.startDate && options.endDate) {
      where.createdAt = Between(options.startDate, options.endDate);
    } else if (options.startDate) {
      where.createdAt = MoreThan(options.startDate);
    } else if (options.endDate) {
      where.createdAt = LessThan(options.endDate);
    }

    if (options.minScore !== undefined && options.maxScore !== undefined) {
      where.overallScore = Between(options.minScore, options.maxScore);
    } else if (options.minScore !== undefined) {
      where.overallScore = MoreThan(options.minScore);
    } else if (options.maxScore !== undefined) {
      where.overallScore = LessThan(options.maxScore);
    }

    const [results, total] = await this.evaluationResultRepo.findAndCount({
      where,
      relations: ['metrics'],
      take: options.limit || 100,
      skip: options.offset || 0,
      order: {
        [options.orderBy || 'createdAt']: options.orderDirection || 'DESC',
      },
    });

    return { results, total };
  }

  async deleteOldResults(daysToKeep: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.evaluationResultRepo.delete({
      createdAt: LessThan(cutoffDate),
    });

    return result.affected || 0;
  }

  private async calculateBatchSummary(batchId: string): Promise<any> {
    const results = await this.evaluationResultRepo.find({
      where: { batchId },
      relations: ['metrics'],
    });

    const scoreDistribution: Record<number, number> = {};
    const metricSums: Record<string, number> = {};
    const metricCounts: Record<string, number> = {};
    const executionTimes: number[] = [];
    const errorCategories: Record<string, number> = {};

    for (const result of results) {
      const scoreRange = Math.floor(result.overallScore / 0.1) * 0.1;
      scoreDistribution[scoreRange] = (scoreDistribution[scoreRange] || 0) + 1;

      executionTimes.push(result.executionTimeMs);

      if (result.error) {
        const category = this.categorizeError(result.error);
        errorCategories[category] = (errorCategories[category] || 0) + 1;
      }

      for (const metric of result.metrics) {
        metricSums[metric.name] = (metricSums[metric.name] || 0) + metric.score;
        metricCounts[metric.name] = (metricCounts[metric.name] || 0) + 1;
      }
    }

    const metricAverages = {};
    for (const metricName in metricSums) {
      metricAverages[metricName] = metricSums[metricName] / metricCounts[metricName];
    }

    const executionStats = {
      totalTime: executionTimes.reduce((a, b) => a + b, 0),
      averageTime:
        executionTimes.length > 0
          ? executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length
          : 0,
      minTime: Math.min(...executionTimes),
      maxTime: Math.max(...executionTimes),
    };

    return {
      scoreDistribution,
      metricAverages,
      executionStats,
      errorCategories,
    };
  }

  private categorizeError(error: string): string {
    if (error.includes('timeout')) return 'timeout';
    if (error.includes('rate limit')) return 'rate_limit';
    if (error.includes('validation')) return 'validation';
    if (error.includes('network')) return 'network';
    if (error.includes('parsing')) return 'parsing';
    return 'other';
  }
}
