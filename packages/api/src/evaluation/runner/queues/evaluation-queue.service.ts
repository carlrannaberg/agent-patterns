import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { Queue, Job } from 'bull';
import { v4 as uuidv4 } from 'uuid';
import {
  EvaluationJob,
  JobType,
  JobPriority,
  JobData,
  JobOptions,
  JobStatus,
  QueueMetrics,
  FailedJob,
  DeadLetterQueue,
} from '../interfaces/queue.interface';
import { TestRunnerService } from '../services/test-runner.service';
import { BatchProcessorService } from '../processors/batch-processor.service';
import { ApiTestingService } from '../services/api-testing.service';
import { EvaluationSchedulerService } from '../schedulers/evaluation-scheduler.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Processor('evaluation')
@Injectable()
export class EvaluationQueueService implements OnModuleInit {
  private readonly logger = new Logger(EvaluationQueueService.name);
  private readonly deadLetterQueue: DeadLetterQueue = {
    jobs: [],
    maxSize: 1000,
    retentionPeriod: 7 * 24 * 60 * 60 * 1000, // 7 days
  };

  constructor(
    @InjectQueue('evaluation') private readonly evaluationQueue: Queue,
    private readonly testRunner: TestRunnerService,
    private readonly batchProcessor: BatchProcessorService,
    private readonly apiTesting: ApiTestingService,
    private readonly scheduler: EvaluationSchedulerService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit() {
    await this.setupQueueEvents();
    await this.cleanupOldJobs();
  }

  async addJob(
    type: JobType,
    data: JobData,
    options?: JobOptions,
    priority: JobPriority = JobPriority.NORMAL,
  ): Promise<EvaluationJob> {
    const jobId = uuidv4();
    const evaluationJob: EvaluationJob = {
      id: jobId,
      type,
      priority,
      data,
      options,
      createdAt: new Date(),
    };

    const jobOptions = {
      priority,
      delay: options?.delay,
      attempts: options?.attempts || 3,
      backoff: options?.backoff || {
        type: 'exponential' as const,
        delay: 2000,
      },
      removeOnComplete: options?.removeOnComplete ?? true,
      removeOnFail: options?.removeOnFail ?? false,
      timeout: options?.timeout || 300000, // 5 minutes default
    };

    await this.evaluationQueue.add(type, evaluationJob, jobOptions);

    this.eventEmitter.emit('queue.job.added', evaluationJob);
    return evaluationJob;
  }

  async addBulkJobs(
    jobs: Array<{ type: JobType; data: JobData; options?: JobOptions; priority?: JobPriority }>,
  ): Promise<EvaluationJob[]> {
    const evaluationJobs = jobs.map((job) => ({
      id: uuidv4(),
      type: job.type,
      priority: job.priority || JobPriority.NORMAL,
      data: job.data,
      options: job.options,
      createdAt: new Date(),
    }));

    const bulkJobs = evaluationJobs.map((job) => ({
      name: job.type,
      data: job,
      opts: {
        priority: job.priority,
        delay: job.options?.delay,
        attempts: job.options?.attempts || 3,
        backoff: job.options?.backoff || {
          type: 'exponential' as const,
          delay: 2000,
        },
        removeOnComplete: job.options?.removeOnComplete ?? true,
        removeOnFail: job.options?.removeOnFail ?? false,
        timeout: job.options?.timeout || 300000,
      },
    }));

    await this.evaluationQueue.addBulk(bulkJobs);

    this.eventEmitter.emit('queue.jobs.bulk.added', evaluationJobs);
    return evaluationJobs;
  }

  @Process()
  async processJob(job: Job<EvaluationJob>): Promise<any> {
    const evaluationJob = job.data;
    this.logger.log(`Processing job ${evaluationJob.id} of type ${evaluationJob.type}`);

    try {
      let result: any;

      switch (evaluationJob.type) {
        case JobType.SINGLE_EVALUATION:
          result = await this.processSingleEvaluation(evaluationJob);
          break;

        case JobType.BATCH_EVALUATION:
          result = await this.processBatchEvaluation(evaluationJob);
          break;

        case JobType.API_TEST:
          result = await this.processApiTest(evaluationJob);
          break;

        case JobType.SCHEDULED_EVALUATION:
          result = await this.processScheduledEvaluation(evaluationJob);
          break;

        default:
          throw new Error(`Unknown job type: ${evaluationJob.type}`);
      }

      this.eventEmitter.emit('queue.job.completed', { job: evaluationJob, result });
      return result;
    } catch (error) {
      this.logger.error(`Job ${evaluationJob.id} failed`, error);
      this.eventEmitter.emit('queue.job.failed', { job: evaluationJob, error });

      if (job.attemptsMade >= (job.opts.attempts || 3)) {
        this.addToDeadLetterQueue(evaluationJob, error);
      }

      throw error;
    }
  }

  private async processSingleEvaluation(job: EvaluationJob): Promise<any> {
    if (!job.data.pattern || !job.data.testSuiteId) {
      throw new Error('Missing required data for single evaluation');
    }

    return this.testRunner.run({
      suiteId: job.data.testSuiteId,
      patterns: [job.data.pattern],
      parallel: false,
    });
  }

  private async processBatchEvaluation(job: EvaluationJob): Promise<any> {
    if (!job.data.batchJobId) {
      throw new Error('Missing batchJobId for batch evaluation');
    }

    return this.batchProcessor.executeBatch(job.data.batchJobId);
  }

  private async processApiTest(job: EvaluationJob): Promise<any> {
    if (!job.data.pattern) {
      throw new Error('Missing pattern for API test');
    }

    return this.apiTesting.testEndpoint(
      {
        pattern: job.data.pattern,
        endpoint: job.data.metadata?.endpoint,
        method: 'POST',
        body: job.data.input,
      },
      {
        baseUrl: process.env.API_BASE_URL || 'http://localhost:3001',
        timeout: 30000,
        retries: 3,
        retryDelay: 1000,
      },
    );
  }

  private async processScheduledEvaluation(job: EvaluationJob): Promise<any> {
    if (!job.data.scheduleId) {
      throw new Error('Missing scheduleId for scheduled evaluation');
    }

    return this.scheduler.runScheduledJob({
      scheduleId: job.data.scheduleId,
      immediate: true,
    });
  }

  async getQueueMetrics(): Promise<QueueMetrics> {
    const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
      this.evaluationQueue.getWaitingCount(),
      this.evaluationQueue.getActiveCount(),
      this.evaluationQueue.getCompletedCount(),
      this.evaluationQueue.getFailedCount(),
      this.evaluationQueue.getDelayedCount(),
      this.evaluationQueue.getPausedCount(),
    ]);

    const jobs = await this.evaluationQueue.getJobs(['completed']);
    const processingTimes = jobs
      .filter((job) => job.finishedOn && job.processedOn)
      .map((job) => job.finishedOn! - job.processedOn!);

    const averageProcessingTime =
      processingTimes.length > 0
        ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length
        : 0;

    const now = Date.now();
    const minute = jobs.filter((job) => job.finishedOn && now - job.finishedOn < 60000).length;
    const hour = jobs.filter((job) => job.finishedOn && now - job.finishedOn < 3600000).length;
    const day = jobs.filter((job) => job.finishedOn && now - job.finishedOn < 86400000).length;

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused,
      totalProcessed: completed,
      averageProcessingTime,
      throughput: {
        minute,
        hour,
        day,
      },
    };
  }

  async pauseQueue(): Promise<void> {
    await this.evaluationQueue.pause();
    this.logger.log('Evaluation queue paused');
    this.eventEmitter.emit('queue.paused');
  }

  async resumeQueue(): Promise<void> {
    await this.evaluationQueue.resume();
    this.logger.log('Evaluation queue resumed');
    this.eventEmitter.emit('queue.resumed');
  }

  async clearQueue(): Promise<void> {
    await this.evaluationQueue.empty();
    this.logger.log('Evaluation queue cleared');
    this.eventEmitter.emit('queue.cleared');
  }

  async retryFailedJob(jobId: string): Promise<void> {
    const failedJobs = await this.evaluationQueue.getFailed();
    const job = failedJobs.find((j) => j.data.id === jobId);

    if (!job) {
      const dlqJob = this.deadLetterQueue.jobs.find((j) => j.job.id === jobId);
      if (dlqJob && dlqJob.canRetry) {
        await this.addJob(dlqJob.job.type, dlqJob.job.data, dlqJob.job.options);
        this.removeFromDeadLetterQueue(jobId);
        return;
      }
      throw new Error(`Failed job ${jobId} not found`);
    }

    await job.retry();
    this.logger.log(`Retrying job ${jobId}`);
  }

  async getDeadLetterQueue(): Promise<DeadLetterQueue> {
    return this.deadLetterQueue;
  }

  private addToDeadLetterQueue(job: EvaluationJob, error: any): void {
    const failedJob: FailedJob = {
      job,
      error: {
        message: error.message,
        stack: error.stack,
        code: error.code,
      },
      failedAt: new Date(),
      attempts: job.attempts || 1,
      canRetry: true,
    };

    this.deadLetterQueue.jobs.push(failedJob);

    if (this.deadLetterQueue.jobs.length > this.deadLetterQueue.maxSize) {
      this.deadLetterQueue.jobs.shift();
    }

    this.eventEmitter.emit('queue.dlq.added', failedJob);
  }

  private removeFromDeadLetterQueue(jobId: string): void {
    const index = this.deadLetterQueue.jobs.findIndex((j) => j.job.id === jobId);
    if (index !== -1) {
      this.deadLetterQueue.jobs.splice(index, 1);
    }
  }

  private async setupQueueEvents(): Promise<void> {
    this.evaluationQueue.on('active', (job) => {
      this.logger.debug(`Job ${job.id} started`);
    });

    this.evaluationQueue.on('completed', (job, result) => {
      this.logger.debug(`Job ${job.id} completed`);
    });

    this.evaluationQueue.on('failed', (job, error) => {
      this.logger.error(`Job ${job.id} failed: ${error.message}`);
    });

    this.evaluationQueue.on('stalled', (job) => {
      this.logger.warn(`Job ${job.id} stalled`);
    });

    this.evaluationQueue.on('progress', (job, progress) => {
      this.logger.debug(`Job ${job.id} progress: ${progress}%`);
    });
  }

  private async cleanupOldJobs(): Promise<void> {
    const now = Date.now();

    this.deadLetterQueue.jobs = this.deadLetterQueue.jobs.filter(
      (job) => now - job.failedAt.getTime() < this.deadLetterQueue.retentionPeriod,
    );

    const jobs = await this.evaluationQueue.getJobs(['completed', 'failed']);
    const oldJobs = jobs.filter((job) => {
      const age = now - (job.finishedOn || job.timestamp);
      return age > 24 * 60 * 60 * 1000; // 24 hours
    });

    await Promise.all(oldJobs.map((job) => job.remove()));

    this.logger.log(`Cleaned up ${oldJobs.length} old jobs`);
  }
}
