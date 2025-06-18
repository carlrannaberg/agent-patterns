import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';
import { 
  TestRunner, 
  TestRun, 
  TestRunOptions, 
  TestRunStatus, 
  TestSuite, 
  TestCase,
  TestRunResult,
  TestResultStatus,
  TestError,
} from '../interfaces/runner.interface';
import { EvaluationService } from '../../services/evaluation.service';
import { AgentPattern } from '../../enums/agent-pattern.enum';
import { TestSuiteService } from './test-suite.service';

@Injectable()
export class TestRunnerService implements TestRunner {
  private readonly logger = new Logger(TestRunnerService.name);
  private readonly activeRuns = new Map<string, TestRun>();

  constructor(
    private readonly evaluationService: EvaluationService,
    private readonly testSuiteService: TestSuiteService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async run(options: TestRunOptions): Promise<TestRun> {
    const runId = uuidv4();
    const suite = await this.getOrCreateSuite(options);
    
    const testRun: TestRun = {
      id: runId,
      suiteId: suite.id,
      status: TestRunStatus.PENDING,
      results: [],
      startedAt: new Date(),
      metadata: {
        options,
        suite: suite.name,
      },
    };

    this.activeRuns.set(runId, testRun);
    this.eventEmitter.emit('test.run.started', testRun);

    try {
      testRun.status = TestRunStatus.RUNNING;
      const testCases = this.filterTestCases(suite.testCases, options);

      if (options.parallel && suite.config.parallel) {
        await this.runParallel(testRun, testCases, suite);
      } else {
        await this.runSequential(testRun, testCases, suite);
      }

      testRun.status = TestRunStatus.COMPLETED;
    } catch (error) {
      this.logger.error(`Test run ${runId} failed`, error);
      testRun.status = TestRunStatus.FAILED;
      throw error;
    } finally {
      testRun.completedAt = new Date();
      testRun.duration = testRun.completedAt.getTime() - testRun.startedAt.getTime();
      this.eventEmitter.emit('test.run.completed', testRun);
    }

    return testRun;
  }

  async cancel(runId: string): Promise<void> {
    const testRun = this.activeRuns.get(runId);
    if (!testRun) {
      throw new Error(`Test run ${runId} not found`);
    }

    testRun.status = TestRunStatus.CANCELLED;
    this.eventEmitter.emit('test.run.cancelled', testRun);
    this.activeRuns.delete(runId);
  }

  async getStatus(runId: string): Promise<TestRun> {
    const testRun = this.activeRuns.get(runId);
    if (!testRun) {
      throw new Error(`Test run ${runId} not found`);
    }
    return testRun;
  }

  private async getOrCreateSuite(options: TestRunOptions): Promise<TestSuite> {
    if (options.suiteId) {
      return this.testSuiteService.getSuite(options.suiteId);
    }

    return this.testSuiteService.createDefaultSuite(options.patterns || []);
  }

  private filterTestCases(testCases: TestCase[], options: TestRunOptions): TestCase[] {
    let filtered = [...testCases];

    if (options.patterns && options.patterns.length > 0) {
      filtered = filtered.filter(tc => options.patterns.includes(tc.pattern));
    }

    if (options.tags && options.tags.length > 0) {
      filtered = filtered.filter(tc => 
        tc.metadata?.tags?.some((tag: string) => options.tags.includes(tag))
      );
    }

    return filtered;
  }

  private async runSequential(
    testRun: TestRun, 
    testCases: TestCase[], 
    suite: TestSuite
  ): Promise<void> {
    for (const testCase of testCases) {
      if (testRun.status === TestRunStatus.CANCELLED) {
        break;
      }

      const result = await this.runTestCase(testCase, suite);
      testRun.results.push(result);
      this.eventEmitter.emit('test.case.completed', { testRun, result });
    }
  }

  private async runParallel(
    testRun: TestRun, 
    testCases: TestCase[], 
    suite: TestSuite
  ): Promise<void> {
    const maxConcurrency = suite.config.maxConcurrency || 5;
    const chunks = this.chunkArray(testCases, maxConcurrency);

    for (const chunk of chunks) {
      if (testRun.status === TestRunStatus.CANCELLED) {
        break;
      }

      const promises = chunk.map(testCase => this.runTestCase(testCase, suite));
      const results = await Promise.all(promises);
      
      results.forEach(result => {
        testRun.results.push(result);
        this.eventEmitter.emit('test.case.completed', { testRun, result });
      });
    }
  }

  private async runTestCase(
    testCase: TestCase, 
    suite: TestSuite
  ): Promise<TestRunResult> {
    const startedAt = new Date();
    let retryCount = 0;
    let lastError: TestError | undefined;

    const maxRetries = suite.config.retryAttempts || 0;

    while (retryCount <= maxRetries) {
      try {
        const evaluationResult = await this.evaluationService.evaluatePattern(
          testCase.pattern,
          testCase.input,
          testCase.expectedOutput,
        );

        return {
          testCaseId: testCase.id,
          pattern: testCase.pattern,
          status: evaluationResult.score >= 0.7 ? TestResultStatus.PASSED : TestResultStatus.FAILED,
          evaluationResult,
          startedAt,
          completedAt: new Date(),
          duration: new Date().getTime() - startedAt.getTime(),
          retryCount,
        };
      } catch (error) {
        lastError = {
          code: 'EVALUATION_ERROR',
          message: error.message,
          stack: error.stack,
          details: error,
        };

        if (retryCount < maxRetries) {
          retryCount++;
          await this.delay(suite.config.retryDelay || 1000 * retryCount);
        } else {
          break;
        }
      }
    }

    return {
      testCaseId: testCase.id,
      pattern: testCase.pattern,
      status: TestResultStatus.ERROR,
      error: lastError,
      startedAt,
      completedAt: new Date(),
      duration: new Date().getTime() - startedAt.getTime(),
      retryCount,
    };
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}