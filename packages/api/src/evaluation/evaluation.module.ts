import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
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
import { ResultsStorageService } from './services/results-storage.service';
import { AggregationService } from './services/aggregation.service';
import { FailureAnalysisService } from './services/failure-analysis.service';
import { AlertingService } from './services/alerting.service';
import { ReportGeneratorService } from './services/report-generator.service';
import { SequentialProcessingEvaluator } from './evaluators/sequential-processing.evaluator';
import { RoutingEvaluator } from './evaluators/routing.evaluator';
import { ParallelProcessingEvaluator } from './evaluators/parallel-processing.evaluator';
import { OrchestratorWorkerEvaluator } from './evaluators/orchestrator-worker.evaluator';
import { EvaluatorOptimizerEvaluator } from './evaluators/evaluator-optimizer.evaluator';
import { MultiStepToolUsageEvaluator } from './evaluators/multi-step-tool-usage.evaluator';
import { HumanScoringController } from './controllers/human-scoring.controller';
import { RunnerModule } from './runner/runner.module';
import { ReportingModule } from './reporting/reporting.module';
import {
  EvaluationResult,
  EvaluationBatch,
  MetricScore,
  QualityBaseline,
  FailurePattern,
  AlertConfiguration,
  AlertHistory,
} from '../database/entities';
import { EvaluationController } from './controllers/evaluation.controller';

@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    TypeOrmModule.forFeature([
      EvaluationResult,
      EvaluationBatch,
      MetricScore,
      QualityBaseline,
      FailurePattern,
      AlertConfiguration,
      AlertHistory,
    ]),
    forwardRef(() => RunnerModule),
    ReportingModule,
  ],
  controllers: [HumanScoringController, EvaluationController],
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
    ResultsStorageService,
    AggregationService,
    FailureAnalysisService,
    AlertingService,
    ReportGeneratorService,
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
    ResultsStorageService,
    AggregationService,
    FailureAnalysisService,
    AlertingService,
    ReportGeneratorService,
    SequentialProcessingEvaluator,
    RoutingEvaluator,
    ParallelProcessingEvaluator,
    OrchestratorWorkerEvaluator,
    EvaluatorOptimizerEvaluator,
    MultiStepToolUsageEvaluator,
    RunnerModule,
    ReportingModule,
  ],
})
export class EvaluationModule {}
