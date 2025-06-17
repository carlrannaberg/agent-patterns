import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
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
