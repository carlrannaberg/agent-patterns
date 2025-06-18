import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AggregationService } from './aggregation.service';
import { EvaluationResult, QualityBaseline, FailurePattern } from '../../database/entities';

describe('AggregationService', () => {
  let service: AggregationService;
  let evaluationResultRepo: Repository<EvaluationResult>;
  let qualityBaselineRepo: Repository<QualityBaseline>;
  let failurePatternRepo: Repository<FailurePattern>;

  const mockEvaluationResultRepository = {
    createQueryBuilder: jest.fn(),
  };

  const mockQualityBaselineRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockFailurePatternRepository = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AggregationService,
        {
          provide: getRepositoryToken(EvaluationResult),
          useValue: mockEvaluationResultRepository,
        },
        {
          provide: getRepositoryToken(QualityBaseline),
          useValue: mockQualityBaselineRepository,
        },
        {
          provide: getRepositoryToken(FailurePattern),
          useValue: mockFailurePatternRepository,
        },
      ],
    }).compile();

    service = module.get<AggregationService>(AggregationService);
    evaluationResultRepo = module.get<Repository<EvaluationResult>>(
      getRepositoryToken(EvaluationResult),
    );
    qualityBaselineRepo = module.get<Repository<QualityBaseline>>(
      getRepositoryToken(QualityBaseline),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('aggregateMetrics', () => {
    it('should aggregate metrics for a pattern type', async () => {
      const mockResults = [
        {
          id: '1',
          patternType: 'sequential-processing',
          metrics: [
            { name: 'accuracy', score: 0.9 },
            { name: 'latency', score: 0.8 },
          ],
        },
        {
          id: '2',
          patternType: 'sequential-processing',
          metrics: [
            { name: 'accuracy', score: 0.85 },
            { name: 'latency', score: 0.75 },
          ],
        },
      ];

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockResults),
      };

      mockEvaluationResultRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockQualityBaselineRepository.findOne.mockResolvedValue(null);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const result = await service.aggregateMetrics('sequential-processing', startDate, endDate);

      expect(result).toHaveLength(2);
      expect(result[0].metric).toBe('accuracy');
      expect(result[0].statistics.mean).toBeCloseTo(0.875);
      expect(result[1].metric).toBe('latency');
      expect(result[1].statistics.mean).toBeCloseTo(0.775);
    });

    it('should handle empty results', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockEvaluationResultRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.aggregateMetrics('non-existent-pattern', new Date(), new Date());

      expect(result).toEqual([]);
    });
  });

  describe('calculateTimeSeriesMetrics', () => {
    it('should calculate time series metrics', async () => {
      const mockRawResults = [
        {
          period: new Date('2024-01-01'),
          avg_score: '0.85',
          min_score: '0.80',
          max_score: '0.90',
          count: '10',
          std_dev: '0.05',
        },
        {
          period: new Date('2024-01-02'),
          avg_score: '0.87',
          min_score: '0.82',
          max_score: '0.92',
          count: '12',
          std_dev: '0.04',
        },
      ];

      const mockQueryBuilder = {
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(mockRawResults),
      };

      mockEvaluationResultRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.calculateTimeSeriesMetrics(
        'sequential-processing',
        'accuracy',
        new Date('2024-01-01'),
        new Date('2024-01-02'),
      );

      expect(result).toHaveLength(2);
      expect(result[0].avgScore).toBe(0.85);
      expect(result[0].count).toBe(10);
      expect(result[1].avgScore).toBe(0.87);
    });
  });

  describe('detectAnomalies', () => {
    it('should detect anomalies based on baseline', async () => {
      const mockBaseline = {
        mean: 0.85,
        stdDeviation: 0.05,
      };

      const mockAnomalies = [
        {
          id: '1',
          patternType: 'sequential-processing',
          metrics: [{ name: 'accuracy', score: 0.95 }],
        },
        {
          id: '2',
          patternType: 'sequential-processing',
          metrics: [{ name: 'accuracy', score: 0.7 }],
        },
      ];

      mockQualityBaselineRepository.findOne.mockResolvedValue(mockBaseline);

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockAnomalies),
      };

      mockEvaluationResultRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.detectAnomalies('sequential-processing', 'accuracy');

      expect(result).toHaveLength(2);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'ABS(metric.score - :mean) > :threshold * :stdDev',
        expect.any(Object),
      );
    });

    it('should return empty array when no baseline exists', async () => {
      mockQualityBaselineRepository.findOne.mockResolvedValue(null);

      const result = await service.detectAnomalies('non-existent-pattern', 'accuracy');

      expect(result).toEqual([]);
    });
  });

  describe('updateQualityBaselines', () => {
    it('should update quality baselines for all pattern types', async () => {
      const mockPatternTypes = [
        { patternType: 'sequential-processing' },
        { patternType: 'routing' },
      ];

      const mockMetrics = [{ name: 'accuracy' }, { name: 'latency' }];

      const mockScores = [{ score: '0.85' }, { score: '0.87' }, { score: '0.90' }];

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawMany: jest
          .fn()
          .mockResolvedValueOnce(mockPatternTypes)
          .mockResolvedValue(mockMetrics),
      };

      const mockScoreQueryBuilder = {
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(mockScores),
      };

      mockEvaluationResultRepository.createQueryBuilder
        .mockReturnValueOnce(mockQueryBuilder)
        .mockReturnValue(mockScoreQueryBuilder);

      mockQualityBaselineRepository.findOne.mockResolvedValue(null);
      mockQualityBaselineRepository.create.mockReturnValue({});
      mockQualityBaselineRepository.save.mockResolvedValue({});

      await service.updateQualityBaselines();

      expect(mockQualityBaselineRepository.save).toHaveBeenCalled();
    });
  });
});
