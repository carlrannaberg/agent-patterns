import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportingController } from './reporting.controller';
import { ReportingService } from './reporting.service';
import { ResultsStorageService } from '../services/results-storage.service';
import { AggregationService } from '../services/aggregation.service';
import { FailureAnalysisService } from '../services/failure-analysis.service';
import { AlertingService } from '../services/alerting.service';
import { ReportGeneratorService } from '../services/report-generator.service';
import {
  EvaluationResult,
  EvaluationBatch,
  MetricScore,
  QualityBaseline,
  FailurePattern,
  AlertConfiguration,
  AlertHistory,
} from '../../database/entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EvaluationResult,
      EvaluationBatch,
      MetricScore,
      QualityBaseline,
      FailurePattern,
      AlertConfiguration,
      AlertHistory,
    ]),
  ],
  controllers: [ReportingController],
  providers: [
    ReportingService,
    ResultsStorageService,
    AggregationService,
    FailureAnalysisService,
    AlertingService,
    ReportGeneratorService,
  ],
  exports: [
    ReportingService,
    ResultsStorageService,
    AggregationService,
    FailureAnalysisService,
    AlertingService,
    ReportGeneratorService,
  ],
})
export class ReportingModule {}
