import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EvaluationService } from './services/evaluation.service';
import { LlmJudgeService } from './services/llm-judge.service';
import { GEvalService } from './services/g-eval.service';
import { TestCaseService } from './services/test-case.service';
import { ReliabilityService } from './services/reliability.service';
import { EvaluationConfigService } from './services/evaluation-config.service';
import { SequentialProcessingEvaluator } from './evaluators/sequential-processing.evaluator';
import { RoutingEvaluator } from './evaluators/routing.evaluator';
import { ParallelProcessingEvaluator } from './evaluators/parallel-processing.evaluator';
import { OrchestratorWorkerEvaluator } from './evaluators/orchestrator-worker.evaluator';
import { EvaluatorOptimizerEvaluator } from './evaluators/evaluator-optimizer.evaluator';
import { MultiStepToolUsageEvaluator } from './evaluators/multi-step-tool-usage.evaluator';

@Module({
  imports: [ConfigModule],
  providers: [
    EvaluationService,
    LlmJudgeService,
    GEvalService,
    TestCaseService,
    ReliabilityService,
    EvaluationConfigService,
    SequentialProcessingEvaluator,
    RoutingEvaluator,
    ParallelProcessingEvaluator,
    OrchestratorWorkerEvaluator,
    EvaluatorOptimizerEvaluator,
    MultiStepToolUsageEvaluator,
  ],
  exports: [
    EvaluationService,
    TestCaseService,
    EvaluationConfigService,
    SequentialProcessingEvaluator,
    RoutingEvaluator,
    ParallelProcessingEvaluator,
    OrchestratorWorkerEvaluator,
    EvaluatorOptimizerEvaluator,
    MultiStepToolUsageEvaluator,
  ],
})
export class EvaluationModule {}
