import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { CacheModule } from '@nestjs/cache-manager';
import { HttpModule } from '@nestjs/axios';
import { EventEmitterModule } from '@nestjs/event-emitter';
import * as redisStore from 'cache-manager-redis-yet';

// Services
import { TestRunnerService } from './services/test-runner.service';
import { TestSuiteService } from './services/test-suite.service';
import { ApiTestingService } from './services/api-testing.service';
import { RateLimitService } from './services/rate-limit.service';
import { RetryService } from './services/retry.service';
import { EvaluationCacheService } from './services/evaluation-cache.service';
import { MetricsService } from './services/metrics.service';
import { WorkflowOrchestratorService } from './services/workflow-orchestrator.service';

// Processors
import { BatchProcessorService } from './processors/batch-processor.service';

// Schedulers
import { EvaluationSchedulerService } from './schedulers/evaluation-scheduler.service';

// Queues
import { EvaluationQueueService } from './queues/evaluation-queue.service';

// Controllers
import { AutomationController } from './controllers/automation.controller';

// Import evaluation module for core services
import { EvaluationModule } from '../evaluation.module';

@Module({
  imports: [
    EvaluationModule,
    HttpModule,
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      maxListeners: 20,
    }),
    BullModule.registerQueue({
      name: 'evaluation',
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
      },
    }),
    CacheModule.register({
      isGlobal: true,
      store: redisStore,
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      ttl: 3600, // 1 hour default
    }),
  ],
  providers: [
    TestRunnerService,
    TestSuiteService,
    ApiTestingService,
    BatchProcessorService,
    EvaluationSchedulerService,
    EvaluationQueueService,
    RateLimitService,
    RetryService,
    EvaluationCacheService,
    MetricsService,
    WorkflowOrchestratorService,
  ],
  controllers: [AutomationController],
  exports: [
    TestRunnerService,
    TestSuiteService,
    ApiTestingService,
    BatchProcessorService,
    EvaluationSchedulerService,
    EvaluationQueueService,
    RateLimitService,
    RetryService,
    EvaluationCacheService,
    MetricsService,
    WorkflowOrchestratorService,
  ],
})
export class RunnerModule {}