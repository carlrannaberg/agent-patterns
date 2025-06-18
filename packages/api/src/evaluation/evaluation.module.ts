import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EvaluationService } from './services/evaluation.service';
import { LlmJudgeService } from './services/llm-judge.service';
import { GEvalService } from './services/g-eval.service';
import { TestCaseService } from './services/test-case.service';
import { ReliabilityService } from './services/reliability.service';
import { EvaluationConfigService } from './services/evaluation-config.service';
import { GoldDatasetService } from './services/gold-dataset.service';
import { CalibrationService } from './services/calibration.service';
import { HumanScoringService } from './services/human-scoring.service';
import { EnsembleEvaluationService } from './services/ensemble-evaluation.service';
import { BiasDetectionService } from './services/bias-detection.service';
import { SequentialProcessingEvaluator } from './evaluators/sequential-processing.evaluator';
import { RoutingEvaluator } from './evaluators/routing.evaluator';
import { ParallelProcessingEvaluator } from './evaluators/parallel-processing.evaluator';
import { OrchestratorWorkerEvaluator } from './evaluators/orchestrator-worker.evaluator';
import { EvaluatorOptimizerEvaluator } from './evaluators/evaluator-optimizer.evaluator';
import { MultiStepToolUsageEvaluator } from './evaluators/multi-step-tool-usage.evaluator';
import { HumanScoringController } from './controllers/human-scoring.controller';

@Module({
  imports: [ConfigModule],
  controllers: [HumanScoringController],
  providers: [
    EvaluationService,
    LlmJudgeService,
    GEvalService,
    TestCaseService,
    ReliabilityService,
    EvaluationConfigService,
    GoldDatasetService,
    CalibrationService,
    HumanScoringService,
    EnsembleEvaluationService,
    BiasDetectionService,
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
    GoldDatasetService,
    CalibrationService,
    HumanScoringService,
    EnsembleEvaluationService,
    BiasDetectionService,
    SequentialProcessingEvaluator,
    RoutingEvaluator,
    ParallelProcessingEvaluator,
    OrchestratorWorkerEvaluator,
    EvaluatorOptimizerEvaluator,
    MultiStepToolUsageEvaluator,
  ],
})
export class EvaluationModule {}
