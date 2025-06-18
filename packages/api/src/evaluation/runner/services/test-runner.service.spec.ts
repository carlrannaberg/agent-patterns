import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TestRunnerService } from './test-runner.service';
import { TestSuiteService } from './test-suite.service';
import { EvaluationService } from '../../services/evaluation.service';
import { AgentPattern } from '../../enums/agent-pattern.enum';
import { TestRunStatus, TestResultStatus } from '../interfaces/runner.interface';

describe('TestRunnerService', () => {
  let service: TestRunnerService;
  let evaluationService: jest.Mocked<EvaluationService>;
  let testSuiteService: jest.Mocked<TestSuiteService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TestRunnerService,
        {
          provide: EvaluationService,
          useValue: {
            evaluatePattern: jest.fn(),
          },
        },
        {
          provide: TestSuiteService,
          useValue: {
            getSuite: jest.fn(),
            createDefaultSuite: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TestRunnerService>(TestRunnerService);
    evaluationService = module.get(EvaluationService);
    testSuiteService = module.get(TestSuiteService);
    eventEmitter = module.get(EventEmitter2);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('run', () => {
    it('should run test suite successfully', async () => {
      const mockSuite = {
        id: 'test-suite',
        name: 'Test Suite',
        testCases: [
          {
            id: 'test-1',
            pattern: AgentPattern.SEQUENTIAL_PROCESSING,
            input: { text: 'test' },
            expectedOutput: { result: 'expected' },
          },
        ],
        config: {
          parallel: false,
          retryAttempts: 0,
        },
      };

      const mockEvaluationResult = {
        score: 0.9,
        details: {},
        passed: true,
      };

      testSuiteService.getSuite.mockResolvedValue(mockSuite);
      evaluationService.evaluatePattern.mockResolvedValue(mockEvaluationResult);

      const result = await service.run({ suiteId: 'test-suite' });

      expect(result).toBeDefined();
      expect(result.status).toBe(TestRunStatus.COMPLETED);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].status).toBe(TestResultStatus.PASSED);
      expect(eventEmitter.emit).toHaveBeenCalledWith('test.run.started', expect.any(Object));
      expect(eventEmitter.emit).toHaveBeenCalledWith('test.run.completed', expect.any(Object));
    });

    it('should handle test failures', async () => {
      const mockSuite = {
        id: 'test-suite',
        name: 'Test Suite',
        testCases: [
          {
            id: 'test-1',
            pattern: AgentPattern.SEQUENTIAL_PROCESSING,
            input: { text: 'test' },
          },
        ],
        config: {
          parallel: false,
          retryAttempts: 0,
        },
      };

      testSuiteService.getSuite.mockResolvedValue(mockSuite);
      evaluationService.evaluatePattern.mockRejectedValue(new Error('Evaluation failed'));

      const result = await service.run({ suiteId: 'test-suite' });

      expect(result.status).toBe(TestRunStatus.COMPLETED);
      expect(result.results[0].status).toBe(TestResultStatus.ERROR);
      expect(result.results[0].error).toBeDefined();
    });

    it('should run tests in parallel when configured', async () => {
      const mockSuite = {
        id: 'test-suite',
        name: 'Test Suite',
        testCases: Array(10)
          .fill(null)
          .map((_, i) => ({
            id: `test-${i}`,
            pattern: AgentPattern.SEQUENTIAL_PROCESSING,
            input: { text: `test-${i}` },
          })),
        config: {
          parallel: true,
          maxConcurrency: 5,
        },
      };

      testSuiteService.createDefaultSuite.mockResolvedValue(mockSuite);
      evaluationService.evaluatePattern.mockResolvedValue({
        score: 0.9,
        details: {},
        passed: true,
      });

      const result = await service.run({
        patterns: [AgentPattern.SEQUENTIAL_PROCESSING],
        parallel: true,
      });

      expect(result.status).toBe(TestRunStatus.COMPLETED);
      expect(result.results).toHaveLength(10);
    });

    it('should retry failed tests based on configuration', async () => {
      const mockSuite = {
        id: 'test-suite',
        name: 'Test Suite',
        testCases: [
          {
            id: 'test-1',
            pattern: AgentPattern.SEQUENTIAL_PROCESSING,
            input: { text: 'test' },
          },
        ],
        config: {
          parallel: false,
          retryAttempts: 2,
          retryDelay: 100,
        },
      };

      testSuiteService.getSuite.mockResolvedValue(mockSuite);

      let attempts = 0;
      evaluationService.evaluatePattern.mockImplementation(async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return { score: 0.9, details: {}, passed: true };
      });

      const result = await service.run({ suiteId: 'test-suite' });

      expect(result.results[0].status).toBe(TestResultStatus.PASSED);
      expect(result.results[0].retryCount).toBe(2);
      expect(evaluationService.evaluatePattern).toHaveBeenCalledTimes(3);
    });
  });

  describe('cancel', () => {
    it('should cancel running test', async () => {
      const mockSuite = {
        id: 'test-suite',
        name: 'Test Suite',
        testCases: [{ id: 'test-1', pattern: AgentPattern.SEQUENTIAL_PROCESSING, input: {} }],
        config: { parallel: false },
      };

      testSuiteService.getSuite.mockResolvedValue(mockSuite);
      evaluationService.evaluatePattern.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000)),
      );

      const runPromise = service.run({ suiteId: 'test-suite' });
      const runId = (await service['activeRuns'].keys().next()).value;

      await service.cancel(runId);
      const result = await runPromise;

      expect(result.status).toBe(TestRunStatus.CANCELLED);
      expect(eventEmitter.emit).toHaveBeenCalledWith('test.run.cancelled', expect.any(Object));
    });

    it('should throw error for non-existent run', async () => {
      await expect(service.cancel('non-existent')).rejects.toThrow(
        'Test run non-existent not found',
      );
    });
  });

  describe('getStatus', () => {
    it('should return test run status', async () => {
      const mockSuite = {
        id: 'test-suite',
        name: 'Test Suite',
        testCases: [],
        config: { parallel: false },
      };

      testSuiteService.getSuite.mockResolvedValue(mockSuite);

      const runPromise = service.run({ suiteId: 'test-suite' });
      const runId = (await service['activeRuns'].keys().next()).value;

      const status = await service.getStatus(runId);
      expect(status).toBeDefined();
      expect(status.status).toBe(TestRunStatus.RUNNING);

      await runPromise;
    });

    it('should throw error for non-existent run', async () => {
      await expect(service.getStatus('non-existent')).rejects.toThrow(
        'Test run non-existent not found',
      );
    });
  });
});
