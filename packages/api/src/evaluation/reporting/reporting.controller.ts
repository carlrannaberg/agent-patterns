import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpStatus,
  HttpCode,
  ValidationPipe,
  UseInterceptors,
} from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { ReportingService } from './reporting.service';
import { ResultsStorageService } from '../services/results-storage.service';
import { AggregationService } from '../services/aggregation.service';
import { FailureAnalysisService } from '../services/failure-analysis.service';
import { AlertingService } from '../services/alerting.service';
import { ReportGeneratorService } from '../services/report-generator.service';
import {
  EvaluationResultsQueryDto,
  TimeSeriesQueryDto,
  CreateAlertDto,
  GenerateReportDto,
} from './reporting.dto';

@Controller('evaluation/reporting')
@UseInterceptors(CacheInterceptor)
export class ReportingController {
  constructor(
    private readonly reportingService: ReportingService,
    private readonly resultsStorage: ResultsStorageService,
    private readonly aggregation: AggregationService,
    private readonly failureAnalysis: FailureAnalysisService,
    private readonly alerting: AlertingService,
    private readonly reportGenerator: ReportGeneratorService,
  ) {}

  @Get('results')
  @CacheTTL(300)
  async getEvaluationResults(@Query(ValidationPipe) query: EvaluationResultsQueryDto) {
    const results = await this.resultsStorage.queryEvaluationResults({
      patternType: query.patternType,
      testCaseId: query.testCaseId,
      batchId: query.batchId,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      minScore: query.minScore,
      maxScore: query.maxScore,
      success: query.success,
      limit: query.limit || 100,
      offset: query.offset || 0,
      orderBy: query.orderBy,
      orderDirection: query.orderDirection,
    });

    return {
      statusCode: HttpStatus.OK,
      data: results.results,
      meta: {
        total: results.total,
        limit: query.limit || 100,
        offset: query.offset || 0,
      },
    };
  }

  @Get('results/:id')
  @CacheTTL(600)
  async getEvaluationResult(@Param('id') id: string) {
    const result = await this.resultsStorage.getEvaluationResult(id);
    return {
      statusCode: HttpStatus.OK,
      data: result,
    };
  }

  @Get('batches/:id')
  @CacheTTL(600)
  async getEvaluationBatch(@Param('id') id: string) {
    const batch = await this.resultsStorage.getEvaluationBatch(id);
    return {
      statusCode: HttpStatus.OK,
      data: batch,
    };
  }

  @Get('metrics/aggregate')
  @CacheTTL(300)
  async getAggregatedMetrics(@Query(ValidationPipe) query: TimeSeriesQueryDto) {
    const aggregations = await this.aggregation.aggregateMetrics(
      query.patternType,
      new Date(query.startDate),
      new Date(query.endDate),
      query.groupBy || 'day',
    );

    return {
      statusCode: HttpStatus.OK,
      data: aggregations,
    };
  }

  @Get('metrics/time-series')
  @CacheTTL(300)
  async getTimeSeriesMetrics(
    @Query(ValidationPipe) query: TimeSeriesQueryDto & { metric: string },
  ) {
    const timeSeries = await this.aggregation.calculateTimeSeriesMetrics(
      query.patternType,
      query.metric,
      new Date(query.startDate),
      new Date(query.endDate),
      query.interval || 'day',
    );

    return {
      statusCode: HttpStatus.OK,
      data: timeSeries,
    };
  }

  @Get('quality/baselines')
  @CacheTTL(600)
  async getQualityBaselines(
    @Query('patternType') patternType?: string,
    @Query('metric') metric?: string,
    @Query('periodType') periodType?: 'daily' | 'weekly' | 'monthly' | 'all_time',
  ) {
    const baselines = await this.reportingService.getQualityBaselines({
      patternType,
      metric,
      periodType,
    });

    return {
      statusCode: HttpStatus.OK,
      data: baselines,
    };
  }

  @Get('quality/comparison')
  @CacheTTL(300)
  async comparePatternQuality() {
    const comparison = await this.reportingService.comparePatternQuality();
    return {
      statusCode: HttpStatus.OK,
      data: comparison,
    };
  }

  @Get('failures/patterns')
  @CacheTTL(300)
  async getFailurePatterns(
    @Query('patternType') patternType?: string,
    @Query('status') status?: 'active' | 'resolved' | 'monitoring',
  ) {
    const failures = await this.failureAnalysis.getFailurePatterns({
      patternType,
      status,
    });

    return {
      statusCode: HttpStatus.OK,
      data: failures,
    };
  }

  @Get('failures/analysis/:id')
  @CacheTTL(600)
  async getFailureAnalysis(@Param('id') id: string) {
    const analysis = await this.failureAnalysis.getFailureAnalysis(id);
    return {
      statusCode: HttpStatus.OK,
      data: analysis,
    };
  }

  @Get('anomalies')
  @CacheTTL(300)
  async detectAnomalies(
    @Query('patternType') patternType: string,
    @Query('metric') metric: string,
    @Query('threshold') threshold?: number,
  ) {
    const anomalies = await this.aggregation.detectAnomalies(patternType, metric, threshold || 2.5);

    return {
      statusCode: HttpStatus.OK,
      data: anomalies,
    };
  }

  @Get('optimization/opportunities')
  @CacheTTL(600)
  async getOptimizationOpportunities(@Query('patternType') patternType?: string) {
    const opportunities =
      await this.reportingService.identifyOptimizationOpportunities(patternType);

    return {
      statusCode: HttpStatus.OK,
      data: opportunities,
    };
  }

  @Post('alerts/configure')
  @HttpCode(HttpStatus.CREATED)
  async createAlert(@Body(ValidationPipe) dto: CreateAlertDto) {
    const alert = await this.alerting.createAlertConfiguration(dto);
    return {
      statusCode: HttpStatus.CREATED,
      data: alert,
    };
  }

  @Get('alerts/configurations')
  @CacheTTL(300)
  async getAlertConfigurations(
    @Query('enabled') enabled?: boolean,
    @Query('patternType') patternType?: string,
  ) {
    const configs = await this.alerting.getAlertConfigurations({
      enabled,
      patternType,
    });

    return {
      statusCode: HttpStatus.OK,
      data: configs,
    };
  }

  @Get('alerts/history')
  @CacheTTL(300)
  async getAlertHistory(
    @Query('configurationId') configurationId?: string,
    @Query('status') status?: 'triggered' | 'acknowledged' | 'resolved' | 'escalated',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const history = await this.alerting.getAlertHistory({
      configurationId,
      status,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });

    return {
      statusCode: HttpStatus.OK,
      data: history,
    };
  }

  @Post('reports/generate')
  @HttpCode(HttpStatus.OK)
  async generateReport(@Body(ValidationPipe) dto: GenerateReportDto) {
    const report = await this.reportGenerator.generateReport(dto);
    return {
      statusCode: HttpStatus.OK,
      data: report,
    };
  }

  @Get('reports/templates')
  @CacheTTL(3600)
  async getReportTemplates() {
    const templates = await this.reportGenerator.getAvailableTemplates();
    return {
      statusCode: HttpStatus.OK,
      data: templates,
    };
  }

  @Get('dashboard/summary')
  @CacheTTL(300)
  async getDashboardSummary(@Query('period') period: 'day' | 'week' | 'month' = 'week') {
    const summary = await this.reportingService.getDashboardSummary(period);
    return {
      statusCode: HttpStatus.OK,
      data: summary,
    };
  }

  @Get('trends/analysis')
  @CacheTTL(300)
  async getTrendAnalysis(
    @Query('patternType') patternType?: string,
    @Query('metric') metric?: string,
    @Query('period') period: 'week' | 'month' | 'quarter' = 'month',
  ) {
    const trends = await this.reportingService.analyzeTrends({
      patternType,
      metric,
      period,
    });

    return {
      statusCode: HttpStatus.OK,
      data: trends,
    };
  }
}
