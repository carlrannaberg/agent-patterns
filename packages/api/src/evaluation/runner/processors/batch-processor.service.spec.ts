import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BatchProcessorService } from './batch-processor.service';
import { TestRunnerService } from '../services/test-runner.service';
import { AgentPattern } from '../../enums/agent-pattern.enum';
import { BatchJobStatus, ErrorHandlingStrategy } from '../interfaces/batch.interface';
import { TestRunStatus } from '../interfaces/runner.interface';

describe('BatchProcessorService', () => {
  let service: BatchProcessorService;
  let testRunner: jest.Mocked<TestRunnerService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BatchProcessorService,
        {
          provide: TestRunnerService,
          useValue: {
            run: jest.fn(),
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

    service = module.get<BatchProcessorService>(BatchProcessorService);
    testRunner = module.get(TestRunnerService);
    eventEmitter = module.get(EventEmitter2);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createBatchJob', () => {
    it('should create a batch job', async () => {
      const job = await service.createBatchJob(
        'Test Batch',
        [AgentPattern.SEQUENTIAL_PROCESSING, AgentPattern.ROUTING],
        ['suite-1', 'suite-2'],
      );

      expect(job).toBeDefined();
      expect(job.name).toBe('Test Batch');
      expect(job.patterns).toHaveLength(2);
      expect(job.testSuiteIds).toHaveLength(2);
      expect(job.status).toBe(BatchJobStatus.PENDING);
      expect(eventEmitter.emit).toHaveBeenCalledWith('batch.job.created', job);
    });

    it('should apply default configuration', async () => {
      const job = await service.createBatchJob(
        'Test Batch',
        [AgentPattern.SEQUENTIAL_PROCESSING],
        ['suite-1'],
      );

      expect(job.config.parallel).toBe(true);
      expect(job.config.maxConcurrency).toBe(5);
      expect(job.config.errorHandling).toBe(ErrorHandlingStrategy.CONTINUE);
    });
  });

  describe('executeBatch', () => {
    it('should execute batch job sequentially', async () => {
      const job = await service.createBatchJob(
        'Sequential Batch',
        [AgentPattern.SEQUENTIAL_PROCESSING, AgentPattern.ROUTING],
        ['suite-1'],
        { parallel: false },
      );

      const mockTestRun = {
        id: 'test-run-1',
        status: TestRunStatus.COMPLETED,
        results: [
          { status: 'passed', evaluationResult: { score: 0.9 }, duration: 100 },
          { status: 'passed', evaluationResult: { score: 0.8 }, duration: 150 },
        ],
        duration: 250,
      };

      testRunner.run.mockResolvedValue(mockTestRun);

      const results = await service.executeBatch(job.id);

      expect(results).toBeDefined();
      expect(results.testRuns).toHaveLength(2);
      expect(results.summary.totalTests).toBe(4);
      expect(results.summary.passedTests).toBe(4);
      expect(testRunner.run).toHaveBeenCalledTimes(2);
      expect(eventEmitter.emit).toHaveBeenCalledWith('batch.job.started', job);
      expect(eventEmitter.emit).toHaveBeenCalledWith('batch.job.completed', expect.any(Object));
    });

    it('should execute batch job in parallel', async () => {
      const job = await service.createBatchJob(
        'Parallel Batch',
        [AgentPattern.SEQUENTIAL_PROCESSING, AgentPattern.ROUTING],
        ['suite-1', 'suite-2'],
        { parallel: true, maxConcurrency: 2 },
      );

      const mockTestRun = {
        id: 'test-run-1',
        status: TestRunStatus.COMPLETED,
        results: [{ status: 'passed', evaluationResult: { score: 0.9 }, duration: 100 }],
        duration: 100,
      };

      testRunner.run.mockResolvedValue(mockTestRun);

      const results = await service.executeBatch(job.id);

      expect(results.testRuns).toHaveLength(4);
      expect(testRunner.run).toHaveBeenCalledTimes(4);
    });

    it('should handle errors with continue strategy', async () => {
      const job = await service.createBatchJob(
        'Error Batch',
        [AgentPattern.SEQUENTIAL_PROCESSING, AgentPattern.ROUTING],
        ['suite-1'],
        { errorHandling: ErrorHandlingStrategy.CONTINUE },
      );

      testRunner.run
        .mockRejectedValueOnce(new Error('Test error'))
        .mockResolvedValueOnce({
          id: 'test-run-2',
          status: TestRunStatus.COMPLETED,
          results: [{ status: 'passed', evaluationResult: { score: 0.9 }, duration: 100 }],
          duration: 100,
        });

      const results = await service.executeBatch(job.id);

      expect(results.errors).toHaveLength(1);
      expect(results.testRuns).toHaveLength(1);
      expect(job.status).toBe(BatchJobStatus.COMPLETED);
    });

    it('should fail fast with fail-fast strategy', async () => {
      const job = await service.createBatchJob(
        'Fail Fast Batch',
        [AgentPattern.SEQUENTIAL_PROCESSING],
        ['suite-1'],
        { errorHandling: ErrorHandlingStrategy.FAIL_FAST },
      );

      testRunner.run.mockRejectedValue(new Error('Test error'));

      await expect(service.executeBatch(job.id)).rejects.toThrow('Test error');
      expect(job.status).toBe(BatchJobStatus.FAILED);
    });

    it('should throw error for non-existent job', async () => {
      await expect(service.executeBatch('non-existent')).rejects.toThrow('Batch job non-existent not found');
    });
  });

  describe('cancelBatch', () => {
    it('should cancel running batch job', async () => {
      const job = await service.createBatchJob(
        'Cancel Batch',
        [AgentPattern.SEQUENTIAL_PROCESSING],
        ['suite-1'],
      );

      await service.cancelBatch(job.id);

      expect(job.status).toBe(BatchJobStatus.CANCELLED);
      expect(eventEmitter.emit).toHaveBeenCalledWith('batch.job.cancelled', job);
    });

    it('should throw error for non-existent job', async () => {
      await expect(service.cancelBatch('non-existent')).rejects.toThrow('Batch job non-existent not found');
    });
  });

  describe('getBatchStatus', () => {
    it('should return batch job status', async () => {
      const job = await service.createBatchJob(
        'Status Batch',
        [AgentPattern.SEQUENTIAL_PROCESSING],
        ['suite-1'],
      );

      const status = await service.getBatchStatus(job.id);

      expect(status).toBeDefined();
      expect(status.id).toBe(job.id);
      expect(status.status).toBe(BatchJobStatus.PENDING);
    });

    it('should throw error for non-existent job', async () => {
      await expect(service.getBatchStatus('non-existent')).rejects.toThrow('Batch job non-existent not found');
    });
  });

  describe('getAllBatches', () => {
    it('should return all batch jobs', async () => {
      await service.createBatchJob('Batch 1', [AgentPattern.SEQUENTIAL_PROCESSING], ['suite-1']);
      await service.createBatchJob('Batch 2', [AgentPattern.ROUTING], ['suite-2']);

      const batches = await service.getAllBatches();

      expect(batches).toHaveLength(2);
      expect(batches[0].name).toBe('Batch 1');
      expect(batches[1].name).toBe('Batch 2');
    });
  });
});