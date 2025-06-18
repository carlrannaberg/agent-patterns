import { Test, TestingModule } from '@nestjs/testing';
import { ReportingController } from './reporting.controller';
import { ReportingService } from './reporting.service';
import { ResultsStorageService } from '../services/results-storage.service';
import { AggregationService } from '../services/aggregation.service';
import { FailureAnalysisService } from '../services/failure-analysis.service';
import { AlertingService } from '../services/alerting.service';
import { ReportGeneratorService } from '../services/report-generator.service';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { HttpStatus } from '@nestjs/common';

describe('ReportingController', () => {
  let controller: ReportingController;
  let reportingService: ReportingService;
  let resultsStorage: ResultsStorageService;
  let aggregation: AggregationService;
  let failureAnalysis: FailureAnalysisService;
  let alerting: AlertingService;
  let reportGenerator: ReportGeneratorService;

  const mockReportingService = {
    getDashboardSummary: jest.fn(),
    getQualityBaselines: jest.fn(),
    comparePatternQuality: jest.fn(),
    identifyOptimizationOpportunities: jest.fn(),
    analyzeTrends: jest.fn(),
  };

  const mockResultsStorage = {
    queryEvaluationResults: jest.fn(),
    getEvaluationResult: jest.fn(),
    getEvaluationBatch: jest.fn(),
  };

  const mockAggregation = {
    aggregateMetrics: jest.fn(),
    calculateTimeSeriesMetrics: jest.fn(),
    detectAnomalies: jest.fn(),
  };

  const mockFailureAnalysis = {
    getFailurePatterns: jest.fn(),
    getFailureAnalysis: jest.fn(),
  };

  const mockAlerting = {
    createAlertConfiguration: jest.fn(),
    getAlertConfigurations: jest.fn(),
    getAlertHistory: jest.fn(),
  };

  const mockReportGenerator = {
    generateReport: jest.fn(),
    getAvailableTemplates: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportingController],
      providers: [
        { provide: ReportingService, useValue: mockReportingService },
        { provide: ResultsStorageService, useValue: mockResultsStorage },
        { provide: AggregationService, useValue: mockAggregation },
        { provide: FailureAnalysisService, useValue: mockFailureAnalysis },
        { provide: AlertingService, useValue: mockAlerting },
        { provide: ReportGeneratorService, useValue: mockReportGenerator },
      ],
    })
      .overrideInterceptor(CacheInterceptor)
      .useValue({ intercept: jest.fn() })
      .compile();

    controller = module.get<ReportingController>(ReportingController);
    reportingService = module.get<ReportingService>(ReportingService);
    resultsStorage = module.get<ResultsStorageService>(ResultsStorageService);
    aggregation = module.get<AggregationService>(AggregationService);
    failureAnalysis = module.get<FailureAnalysisService>(FailureAnalysisService);
    alerting = module.get<AlertingService>(AlertingService);
    reportGenerator = module.get<ReportGeneratorService>(ReportGeneratorService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getEvaluationResults', () => {
    it('should return paginated evaluation results', async () => {
      const mockResults = {
        results: [
          { id: '1', overallScore: 0.85 },
          { id: '2', overallScore: 0.9 },
        ],
        total: 50,
      };

      mockResultsStorage.queryEvaluationResults.mockResolvedValue(mockResults);

      const query = {
        patternType: 'sequential-processing',
        limit: 10,
        offset: 0,
      };

      const result = await controller.getEvaluationResults(query as any);

      expect(result.statusCode).toBe(HttpStatus.OK);
      expect(result.data).toEqual(mockResults.results);
      expect(result.meta.total).toBe(50);
      expect(result.meta.limit).toBe(10);
    });
  });

  describe('getAggregatedMetrics', () => {
    it('should return aggregated metrics', async () => {
      const mockAggregations = [
        {
          patternType: 'sequential-processing',
          metric: 'accuracy',
          statistics: { mean: 0.85 },
        },
      ];

      mockAggregation.aggregateMetrics.mockResolvedValue(mockAggregations);

      const query = {
        patternType: 'sequential-processing',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        groupBy: 'day' as const,
      };

      const result = await controller.getAggregatedMetrics(query as any);

      expect(result.statusCode).toBe(HttpStatus.OK);
      expect(result.data).toEqual(mockAggregations);
    });
  });

  describe('getDashboardSummary', () => {
    it('should return dashboard summary', async () => {
      const mockSummary = {
        overview: { totalEvaluations: 1000 },
        patternMetrics: [],
        recentTrends: [],
        activeAlerts: [],
      };

      mockReportingService.getDashboardSummary.mockResolvedValue(mockSummary);

      const result = await controller.getDashboardSummary('week');

      expect(result.statusCode).toBe(HttpStatus.OK);
      expect(result.data).toEqual(mockSummary);
    });
  });

  describe('comparePatternQuality', () => {
    it('should return pattern quality comparison', async () => {
      const mockComparison = {
        accuracy: {
          patterns: [
            { patternType: 'sequential-processing', score: 0.85 },
            { patternType: 'routing', score: 0.82 },
          ],
        },
      };

      mockReportingService.comparePatternQuality.mockResolvedValue(mockComparison);

      const result = await controller.comparePatternQuality();

      expect(result.statusCode).toBe(HttpStatus.OK);
      expect(result.data).toEqual(mockComparison);
    });
  });

  describe('detectAnomalies', () => {
    it('should return detected anomalies', async () => {
      const mockAnomalies = [
        { id: '1', overallScore: 0.65 },
        { id: '2', overallScore: 0.95 },
      ];

      mockAggregation.detectAnomalies.mockResolvedValue(mockAnomalies);

      const result = await controller.detectAnomalies('sequential-processing', 'accuracy', 2.5);

      expect(result.statusCode).toBe(HttpStatus.OK);
      expect(result.data).toEqual(mockAnomalies);
    });
  });

  describe('generateReport', () => {
    it('should generate a report', async () => {
      const mockReport = {
        reportId: '123',
        format: 'pdf',
        generatedAt: new Date(),
        url: '/reports/123.pdf',
      };

      mockReportGenerator.generateReport.mockResolvedValue(mockReport);

      const dto = {
        patternType: 'sequential-processing',
        reportType: 'summary' as const,
        format: 'pdf' as const,
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-01-31T23:59:59Z',
      };

      const result = await controller.generateReport(dto);

      expect(result.statusCode).toBe(HttpStatus.OK);
      expect(result.data).toEqual(mockReport);
    });
  });

  describe('createAlert', () => {
    it('should create an alert configuration', async () => {
      const mockAlert = {
        id: '123',
        name: 'Low Score Alert',
        enabled: true,
      };

      mockAlerting.createAlertConfiguration.mockResolvedValue(mockAlert);

      const dto = {
        name: 'Low Score Alert',
        enabled: true,
        patternType: 'sequential-processing',
        alertType: 'score_degradation' as const,
        conditions: {
          metric: 'accuracy',
          operator: 'lt' as const,
          threshold: 0.7,
        },
        notificationChannels: [
          {
            type: 'email' as const,
            config: { recipients: ['test@example.com'] },
          },
        ],
      };

      const result = await controller.createAlert(dto);

      expect(result.statusCode).toBe(HttpStatus.CREATED);
      expect(result.data).toEqual(mockAlert);
    });
  });
});
