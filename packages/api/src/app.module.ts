import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { SequentialProcessingModule } from './sequential-processing/sequential-processing.module';
import { RoutingModule } from './routing/routing.module';
import { ParallelProcessingModule } from './parallel-processing/parallel-processing.module';
import { OrchestratorWorkerModule } from './orchestrator-worker/orchestrator-worker.module';
import { EvaluatorOptimizerModule } from './evaluator-optimizer/evaluator-optimizer.module';
import { MultiStepToolUsageModule } from './multi-step-tool-usage/multi-step-tool-usage.module';
import { EvaluationModule } from './evaluation/evaluation.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    }),
    SequentialProcessingModule,
    RoutingModule,
    ParallelProcessingModule,
    OrchestratorWorkerModule,
    EvaluatorOptimizerModule,
    MultiStepToolUsageModule,
    EvaluationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
