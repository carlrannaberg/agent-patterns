import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SequentialProcessingModule } from './sequential-processing/sequential-processing.module';
import { RoutingModule } from './routing/routing.module';
import { ParallelProcessingModule } from './parallel-processing/parallel-processing.module';
import { OrchestratorWorkerModule } from './orchestrator-worker/orchestrator-worker.module';
import { EvaluatorOptimizerModule } from './evaluator-optimizer/evaluator-optimizer.module';
import { MultiStepToolUsageModule } from './multi-step-tool-usage/multi-step-tool-usage.module';

@Module({
  imports: [
    SequentialProcessingModule,
    RoutingModule,
    ParallelProcessingModule,
    OrchestratorWorkerModule,
    EvaluatorOptimizerModule,
    MultiStepToolUsageModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
