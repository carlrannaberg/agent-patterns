import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';
import {
  BatchJob,
  BatchJobStatus,
  BatchConfig,
  BatchProgress,
  BatchResults,
  BatchSummary,
  PatternBatchResult,
  BatchError,
  BatchPerformance,
  PrioritizationStrategy,
  ErrorHandlingStrategy,
} from '../interfaces/batch.interface';
import { TestRunnerService } from '../services/test-runner.service';
import { TestRunOptions, TestRun, TestRunStatus } from '../interfaces/runner.interface';
import { AgentPattern } from '../../enums/agent-pattern.enum';

@Injectable()
export class BatchProcessorService {
  private readonly logger = new Logger(BatchProcessorService.name);
  private readonly activeJobs = new Map<string, BatchJob>();
  private readonly jobQueue: BatchJob[] = [];
  private isProcessing = false;

  constructor(
    private readonly testRunner: TestRunnerService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.startQueueProcessor();
  }

  async createBatchJob(
    name: string,
    patterns: AgentPattern[],
    testSuiteIds: string[],
    config: Partial<BatchConfig> = {},
  ): Promise<BatchJob> {
    const batchJob: BatchJob = {
      id: uuidv4(),
      name,
      patterns,
      testSuiteIds,
      config: {
        parallel: config.parallel ?? true,
        maxConcurrency: config.maxConcurrency ?? 5,
        prioritization: config.prioritization ?? PrioritizationStrategy.FIFO,
        errorHandling: config.errorHandling ?? ErrorHandlingStrategy.CONTINUE,
        notifications: config.notifications,
        resourceLimits: config.resourceLimits,
      },
      status: BatchJobStatus.PENDING,
      progress: {
        totalTests: 0,
        completedTests: 0,
        failedTests: 0,
        skippedTests: 0,
        percentComplete: 0,
      },
      createdAt: new Date(),
    };

    this.jobQueue.push(batchJob);
    this.activeJobs.set(batchJob.id, batchJob);
    this.eventEmitter.emit('batch.job.created', batchJob);

    return batchJob;
  }

  async executeBatch(jobId: string): Promise<BatchResults> {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      throw new Error(`Batch job ${jobId} not found`);
    }

    job.status = BatchJobStatus.RUNNING;
    job.startedAt = new Date();
    this.eventEmitter.emit('batch.job.started', job);

    const results: BatchResults = {
      testRuns: [],
      summary: this.createEmptySummary(),
      patternResults: new Map(),
      errors: [],
      performance: {
        startTime: job.startedAt,
        endTime: new Date(),
        totalDuration: 0,
        averageTestDuration: 0,
        testsPerMinute: 0,
        tokenUsage: { total: 0, byPattern: new Map() },
        apiCalls: { total: 0, byPattern: new Map() },
      },
    };

    try {
      if (job.config.parallel) {
        await this.executeParallel(job, results);
      } else {
        await this.executeSequential(job, results);
      }

      job.status = BatchJobStatus.COMPLETED;
      this.updateBatchSummary(results);
    } catch (error) {
      this.logger.error(`Batch job ${jobId} failed`, error);
      job.status = BatchJobStatus.FAILED;
      results.errors.push({
        timestamp: new Date(),
        error: error.message,
        stack: error.stack,
        severity: 'critical',
      });

      if (job.config.errorHandling === ErrorHandlingStrategy.FAIL_FAST) {
        throw error;
      }
    } finally {
      job.completedAt = new Date();
      job.results = results;
      results.performance.endTime = job.completedAt;
      results.performance.totalDuration = 
        job.completedAt.getTime() - job.startedAt.getTime();

      this.eventEmitter.emit('batch.job.completed', { job, results });
    }

    return results;
  }

  async cancelBatch(jobId: string): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      throw new Error(`Batch job ${jobId} not found`);
    }

    job.status = BatchJobStatus.CANCELLED;
    this.eventEmitter.emit('batch.job.cancelled', job);
  }

  async getBatchStatus(jobId: string): Promise<BatchJob> {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      throw new Error(`Batch job ${jobId} not found`);
    }
    return job;
  }

  async getAllBatches(): Promise<BatchJob[]> {
    return Array.from(this.activeJobs.values());
  }

  private async executeSequential(job: BatchJob, results: BatchResults): Promise<void> {
    const totalTests = job.patterns.length * job.testSuiteIds.length;
    job.progress.totalTests = totalTests;

    for (const pattern of job.patterns) {
      if (job.status === BatchJobStatus.CANCELLED) break;

      job.progress.currentPattern = pattern;
      
      for (const suiteId of job.testSuiteIds) {
        if (job.status === BatchJobStatus.CANCELLED) break;

        try {
          const testRun = await this.runTestSuite(pattern, suiteId, job);
          results.testRuns.push(testRun);
          this.updateProgress(job, testRun);
          this.updatePatternResults(results, pattern, testRun);
        } catch (error) {
          this.handleTestError(job, results, pattern, suiteId, error);
        }
      }
    }
  }

  private async executeParallel(job: BatchJob, results: BatchResults): Promise<void> {
    const tasks: Array<{ pattern: AgentPattern; suiteId: string }> = [];
    
    for (const pattern of job.patterns) {
      for (const suiteId of job.testSuiteIds) {
        tasks.push({ pattern, suiteId });
      }
    }

    job.progress.totalTests = tasks.length;

    const chunks = this.chunkArray(tasks, job.config.maxConcurrency);
    
    for (const chunk of chunks) {
      if (job.status === BatchJobStatus.CANCELLED) break;

      const promises = chunk.map(async ({ pattern, suiteId }) => {
        try {
          const testRun = await this.runTestSuite(pattern, suiteId, job);
          results.testRuns.push(testRun);
          this.updateProgress(job, testRun);
          this.updatePatternResults(results, pattern, testRun);
          return testRun;
        } catch (error) {
          this.handleTestError(job, results, pattern, suiteId, error);
          return null;
        }
      });

      await Promise.all(promises);
    }
  }

  private async runTestSuite(
    pattern: AgentPattern,
    suiteId: string,
    job: BatchJob,
  ): Promise<TestRun> {
    const options: TestRunOptions = {
      suiteId,
      patterns: [pattern],
      parallel: false,
    };

    job.progress.currentTest = `${pattern}-${suiteId}`;
    const testRun = await this.testRunner.run(options);
    
    return testRun;
  }

  private updateProgress(job: BatchJob, testRun: TestRun): void {
    job.progress.completedTests++;
    
    const failedTests = testRun.results.filter(r => 
      r.status === 'failed' || r.status === 'error'
    ).length;
    
    job.progress.failedTests += failedTests;
    job.progress.percentComplete = 
      (job.progress.completedTests / job.progress.totalTests) * 100;

    this.eventEmitter.emit('batch.progress.updated', job);
  }

  private updatePatternResults(
    results: BatchResults,
    pattern: AgentPattern,
    testRun: TestRun,
  ): void {
    let patternResult = results.patternResults.get(pattern);
    
    if (!patternResult) {
      patternResult = {
        pattern,
        testsRun: 0,
        testsPassed: 0,
        testsFailed: 0,
        averageScore: 0,
        averageLatency: 0,
        errors: [],
      };
      results.patternResults.set(pattern, patternResult);
    }

    patternResult.testsRun += testRun.results.length;
    patternResult.testsPassed += testRun.results.filter(r => r.status === 'passed').length;
    patternResult.testsFailed += testRun.results.filter(r => 
      r.status === 'failed' || r.status === 'error'
    ).length;

    const scores = testRun.results
      .filter(r => r.evaluationResult?.score !== undefined)
      .map(r => r.evaluationResult!.score);
    
    if (scores.length > 0) {
      patternResult.averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    }

    const latencies = testRun.results.map(r => r.duration);
    patternResult.averageLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  }

  private handleTestError(
    job: BatchJob,
    results: BatchResults,
    pattern: AgentPattern,
    suiteId: string,
    error: any,
  ): void {
    const batchError: BatchError = {
      timestamp: new Date(),
      pattern,
      testId: suiteId,
      error: error.message,
      stack: error.stack,
      severity: 'error',
    };

    results.errors.push(batchError);
    job.progress.failedTests++;

    if (job.config.errorHandling === ErrorHandlingStrategy.FAIL_FAST) {
      throw error;
    }
  }

  private updateBatchSummary(results: BatchResults): void {
    const allResults = results.testRuns.flatMap(run => run.results);
    
    results.summary = {
      totalTests: allResults.length,
      passedTests: allResults.filter(r => r.status === 'passed').length,
      failedTests: allResults.filter(r => r.status === 'failed').length,
      errorTests: allResults.filter(r => r.status === 'error').length,
      skippedTests: allResults.filter(r => r.status === 'skipped').length,
      successRate: 0,
      averageScore: 0,
      duration: results.performance.totalDuration,
    };

    if (results.summary.totalTests > 0) {
      results.summary.successRate = 
        results.summary.passedTests / results.summary.totalTests;

      const scores = allResults
        .filter(r => r.evaluationResult?.score !== undefined)
        .map(r => r.evaluationResult!.score);
      
      if (scores.length > 0) {
        results.summary.averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      }
    }
  }

  private createEmptySummary(): BatchSummary {
    return {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      errorTests: 0,
      skippedTests: 0,
      successRate: 0,
      averageScore: 0,
      duration: 0,
    };
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private async startQueueProcessor(): Promise<void> {
    setInterval(async () => {
      if (!this.isProcessing && this.jobQueue.length > 0) {
        this.isProcessing = true;
        
        try {
          const job = this.getNextJob();
          if (job && job.status === BatchJobStatus.PENDING) {
            job.status = BatchJobStatus.QUEUED;
            await this.executeBatch(job.id);
          }
        } catch (error) {
          this.logger.error('Queue processor error', error);
        } finally {
          this.isProcessing = false;
        }
      }
    }, 5000);
  }

  private getNextJob(): BatchJob | undefined {
    const strategy = this.jobQueue[0]?.config.prioritization || PrioritizationStrategy.FIFO;
    
    switch (strategy) {
      case PrioritizationStrategy.FIFO:
        return this.jobQueue.shift();
      case PrioritizationStrategy.LIFO:
        return this.jobQueue.pop();
      default:
        return this.jobQueue.shift();
    }
  }
}