import { Test, TestingModule } from '@nestjs/testing';
import { ReportingService } from './reporting.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  EvaluationResult,
  QualityBaseline,
  FailurePattern,
  AlertConfiguration,
} from '../../database/entities';
import { AggregationService } from '../services/aggregation.service';
import { FailureAnalysisService } from '../services/failure-analysis.service';

describe('ReportingService', () => {
  let service: ReportingService;
  let evaluationResultRepo: Repository<EvaluationResult>;
  let qualityBaselineRepo: Repository<QualityBaseline>;
  let failurePatternRepo: Repository<FailurePattern>;
  let alertConfigRepo: Repository<AlertConfiguration>;
  let aggregationService: AggregationService;
  let failureAnalysisService: FailureAnalysisService;

  const mockRepositoryFactory = () => ({
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  });

  const mockAggregationService = {
    aggregateMetrics: jest.fn(),
    calculateTimeSeriesMetrics: jest.fn(),
    detectAnomalies: jest.fn(),
  };

  const mockFailureAnalysisService = {
    getFailurePatterns: jest.fn(),
    analyzeFailures: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportingService,
        {
          provide: getRepositoryToken(EvaluationResult),
          useFactory: mockRepositoryFactory,
        },
        {
          provide: getRepositoryToken(QualityBaseline),
          useFactory: mockRepositoryFactory,
        },
        {
          provide: getRepositoryToken(FailurePattern),
          useFactory: mockRepositoryFactory,
        },
        {
          provide: getRepositoryToken(AlertConfiguration),
          useFactory: mockRepositoryFactory,
        },
        {
          provide: AggregationService,
          useValue: mockAggregationService,
        },
        {
          provide: FailureAnalysisService,
          useValue: mockFailureAnalysisService,
        },
      ],
    }).compile();

    service = module.get<ReportingService>(ReportingService);
    evaluationResultRepo = module.get<Repository<EvaluationResult>>(
      getRepositoryToken(EvaluationResult),
    );
    qualityBaselineRepo = module.get<Repository<QualityBaseline>>(
      getRepositoryToken(QualityBaseline),
    );
    failurePatternRepo = module.get<Repository<FailurePattern>>(getRepositoryToken(FailurePattern));
    alertConfigRepo = module.get<Repository<AlertConfiguration>>(
      getRepositoryToken(AlertConfiguration),
    );
    aggregationService = module.get<AggregationService>(AggregationService);
    failureAnalysisService = module.get<FailureAnalysisService>(FailureAnalysisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getDashboardSummary', () => {
    it('should return dashboard summary for a given period', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          {
            pattern_type: 'sequential-processing',
            total_evaluations: '100',
            success_rate: '0.85',
            avg_score: '0.87',
          },
          {
            pattern_type: 'routing',
            total_evaluations: '80',
            success_rate: '0.90',
            avg_score: '0.88',
          },
        ]),
        getRawOne: jest.fn().mockResolvedValue({
          total: '180',
          success_count: '160',
          failure_count: '20',
        }),
      };

      evaluationResultRepo.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);
      qualityBaselineRepo.find = jest.fn().mockResolvedValue([]);
      failurePatternRepo.find = jest.fn().mockResolvedValue([]);
      alertConfigRepo.find = jest.fn().mockResolvedValue([]);

      const result = await service.getDashboardSummary('week');

      expect(result).toHaveProperty('period');
      expect(result).toHaveProperty('totalEvaluations');
      expect(result).toHaveProperty('patternPerformance');
      expect(result).toHaveProperty('systemHealth');
      expect(result.totalEvaluations).toBeDefined();
      expect(result.patternPerformance).toBeDefined();
    });
  });

  describe('getQualityBaselines', () => {
    it('should return quality baselines with filters', async () => {
      const mockBaselines = [
        {
          id: '1',
          patternType: 'sequential-processing',
          metricName: 'accuracy',
          periodType: 'weekly',
          mean: 0.85,
          median: 0.86,
          stdDeviation: 0.05,
        },
        {
          id: '2',
          patternType: 'routing',
          metricName: 'latency',
          periodType: 'weekly',
          mean: 0.78,
          median: 0.79,
          stdDeviation: 0.08,
        },
      ];

      qualityBaselineRepo.find = jest.fn().mockResolvedValue(mockBaselines);

      const result = await service.getQualityBaselines({
        patternType: 'sequential-processing',
        periodType: 'weekly',
      });

      expect(result).toEqual(mockBaselines);
      expect(qualityBaselineRepo.find).toHaveBeenCalledWith({
        where: {
          patternType: 'sequential-processing',
          periodType: 'weekly',
        },
        order: { calculatedAt: 'DESC' },
      });
    });
  });

  describe('comparePatternQuality', () => {
    it('should compare quality across patterns', async () => {
      const mockBaselines = [
        {
          patternType: 'sequential-processing',
          metricName: 'accuracy',
          mean: 0.85,
          median: 0.86,
          p95: 0.95,
        },
        {
          patternType: 'routing',
          metricName: 'accuracy',
          mean: 0.82,
          median: 0.83,
          p95: 0.92,
        },
      ];

      qualityBaselineRepo.find = jest.fn().mockResolvedValue(mockBaselines);

      const result = await service.comparePatternQuality();

      expect(result).toHaveProperty('accuracy');
      expect(result.accuracy.patterns).toHaveLength(2);
      expect(result.accuracy.patterns[0].patternType).toBe('sequential-processing');
      expect(result.accuracy.patterns[0].score).toBe(0.85);
    });
  });

  describe('identifyOptimizationOpportunities', () => {
    it('should identify optimization opportunities', async () => {
      const mockBaselines = [
        {
          patternType: 'sequential-processing',
          metricName: 'accuracy',
          mean: 0.85,
          p25: 0.8,
          p75: 0.9,
        },
      ];

      const mockAnomalies = [
        {
          id: '1',
          patternType: 'sequential-processing',
          overallScore: 0.7,
        },
      ];

      const mockFailures = [
        {
          id: '1',
          patternType: 'sequential-processing',
          failureType: 'timeout',
          occurrenceCount: 5,
        },
      ];

      qualityBaselineRepo.find = jest.fn().mockResolvedValue(mockBaselines);
      mockAggregationService.detectAnomalies.mockResolvedValue(mockAnomalies);
      mockFailureAnalysisService.getFailurePatterns.mockResolvedValue(mockFailures);

      const result = await service.identifyOptimizationOpportunities('sequential-processing');

      expect(result).toHaveLength(1);
      expect(result[0].patternType).toBe('sequential-processing');
      expect(result[0].recommendations).toBeDefined();
    });
  });

  describe('analyzeTrends', () => {
    it('should analyze trends for patterns and metrics', async () => {
      const mockTimeSeries = [
        { period: new Date('2024-01-01'), avgScore: 0.85 },
        { period: new Date('2024-01-02'), avgScore: 0.86 },
        { period: new Date('2024-01-03'), avgScore: 0.87 },
      ];

      mockAggregationService.calculateTimeSeriesMetrics.mockResolvedValue(mockTimeSeries);

      const mockBaseline = {
        mean: 0.85,
        trendData: {
          direction: 'improving',
          changePercent: 2.35,
        },
      };

      qualityBaselineRepo.findOne = jest.fn().mockResolvedValue(mockBaseline);

      const result = await service.analyzeTrends({
        patternType: 'sequential-processing',
        metric: 'accuracy',
        period: 'week',
      });

      expect(result).toHaveProperty('trends');
      expect(result.trends).toHaveLength(1);
      expect(result.trends[0].trend.direction).toBe('improving');
    });
  });
});
