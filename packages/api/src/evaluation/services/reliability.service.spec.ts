import { Test, TestingModule } from '@nestjs/testing';
import { ReliabilityService } from './reliability.service';
import { EvaluationResult, MetricScore } from '../interfaces/evaluation.interface';
import { AgentPattern } from '../enums/agent-pattern.enum';
import { JudgeModel } from '../enums/judge-model.enum';

describe('ReliabilityService', () => {
  let service: ReliabilityService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ReliabilityService],
    }).compile();

    service = module.get<ReliabilityService>(ReliabilityService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateReliability', () => {
    const createEvaluationResult = (
      testCaseId: string,
      metricScores: MetricScore[],
    ): EvaluationResult => ({
      testCaseId,
      pattern: AgentPattern.SEQUENTIAL_PROCESSING,
      judgeModel: JudgeModel.GEMINI_2_5_PRO,
      metricScores,
      overallScore: 0.8,
      pass: true,
      executionTimeMs: 100,
      timestamp: new Date(),
    });

    it('should calculate reliability metrics for consistent evaluations', async () => {
      const results: EvaluationResult[] = [
        createEvaluationResult('test-1', [
          { metric: 'quality', score: 8, normalizedScore: 0.8, reasoning: '' },
          { metric: 'clarity', score: 9, normalizedScore: 0.9, reasoning: '' },
        ]),
        createEvaluationResult('test-1', [
          { metric: 'quality', score: 7.5, normalizedScore: 0.75, reasoning: '' },
          { metric: 'clarity', score: 8.5, normalizedScore: 0.85, reasoning: '' },
        ]),
        createEvaluationResult('test-2', [
          { metric: 'quality', score: 7, normalizedScore: 0.7, reasoning: '' },
          { metric: 'clarity', score: 8, normalizedScore: 0.8, reasoning: '' },
        ]),
        createEvaluationResult('test-2', [
          { metric: 'quality', score: 7.2, normalizedScore: 0.72, reasoning: '' },
          { metric: 'clarity', score: 8.3, normalizedScore: 0.83, reasoning: '' },
        ]),
      ];

      const metrics = await service.calculateReliability(results);

      expect(metrics).toBeDefined();
      expect(metrics.krippendorffsAlpha).toBeGreaterThan(0.5); // Moderate to high agreement
      expect(metrics.interRaterAgreement).toBeGreaterThan(0.7); // Good agreement
      expect(metrics.confidenceInterval).toHaveLength(2);
      expect(metrics.confidenceInterval![0]).toBeLessThanOrEqual(metrics.krippendorffsAlpha!);
      expect(metrics.confidenceInterval![1]).toBeGreaterThanOrEqual(metrics.krippendorffsAlpha!);
      expect(metrics.sampleSize).toBe(4);
    });

    it('should handle perfect agreement', async () => {
      const results: EvaluationResult[] = [
        createEvaluationResult('test-1', [
          { metric: 'quality', score: 8, normalizedScore: 0.8, reasoning: '' },
        ]),
        createEvaluationResult('test-1', [
          { metric: 'quality', score: 8, normalizedScore: 0.8, reasoning: '' },
        ]),
      ];

      const metrics = await service.calculateReliability(results);

      expect(metrics.krippendorffsAlpha).toBeCloseTo(1, 2); // Perfect agreement
      expect(metrics.interRaterAgreement).toBe(1); // Perfect agreement
    });

    it('should throw error for insufficient results', async () => {
      const results: EvaluationResult[] = [
        createEvaluationResult('test-1', [
          { metric: 'quality', score: 8, normalizedScore: 0.8, reasoning: '' },
        ]),
      ];

      await expect(service.calculateReliability(results)).rejects.toThrow(
        'At least 2 evaluation results required',
      );
    });

    it('should handle multiple metrics correctly', async () => {
      const results: EvaluationResult[] = [
        createEvaluationResult('test-1', [
          { metric: 'quality', score: 8, normalizedScore: 0.8, reasoning: '' },
          { metric: 'clarity', score: 7, normalizedScore: 0.7, reasoning: '' },
          { metric: 'accuracy', score: 9, normalizedScore: 0.9, reasoning: '' },
        ]),
        createEvaluationResult('test-1', [
          { metric: 'quality', score: 7.5, normalizedScore: 0.75, reasoning: '' },
          { metric: 'clarity', score: 7.2, normalizedScore: 0.72, reasoning: '' },
          { metric: 'accuracy', score: 8.8, normalizedScore: 0.88, reasoning: '' },
        ]),
      ];

      const metrics = await service.calculateReliability(results);

      expect(metrics.krippendorffsAlpha).toBeGreaterThan(0.7); // High agreement
    });
  });

  describe('validateEvaluationConsistency', () => {
    const createResults = (variance: 'low' | 'medium' | 'high'): EvaluationResult[] => {
      const scoreMap = {
        low: [0.8, 0.82, 0.79, 0.81],
        medium: [0.8, 0.65, 0.75, 0.7],
        high: [0.9, 0.4, 0.6, 0.3],
      };

      return scoreMap[variance].map(
        (score, i) =>
          ({
            testCaseId: `test-${Math.floor(i / 2)}`,
            pattern: AgentPattern.SEQUENTIAL_PROCESSING,
            judgeModel: JudgeModel.GEMINI_2_5_PRO,
            metricScores: [
              { metric: 'quality', score: score * 10, normalizedScore: score, reasoning: '' },
            ],
            overallScore: score,
            pass: score > 0.7,
            executionTimeMs: 100,
            timestamp: new Date(),
          }) as EvaluationResult,
      );
    };

    it('should validate consistent evaluations', async () => {
      const results = createResults('low');
      const validation = await service.validateEvaluationConsistency(results);

      expect(validation.isConsistent).toBe(true);
      expect(validation.recommendations).toHaveLength(0);
    });

    it('should detect and recommend for low reliability', async () => {
      const results = createResults('high');
      const validation = await service.validateEvaluationConsistency(results, 0.4);

      expect(validation.isConsistent).toBe(false);
      expect(validation.recommendations.length).toBeGreaterThan(0);
      expect(validation.recommendations.some((r) => r.includes('Low reliability'))).toBe(true);
    });

    it('should detect moderate reliability', async () => {
      const results = createResults('medium');
      const validation = await service.validateEvaluationConsistency(results, 0.8);

      expect(validation.isConsistent).toBe(false);
      expect(validation.recommendations.some((r) => r.includes('Moderate reliability'))).toBe(true);
    });
  });

  describe('calculateCohenKappa', () => {
    it("should calculate Cohen's Kappa for perfect agreement", () => {
      const rater1 = [0.8, 0.6, 0.9, 0.3, 0.7];
      const rater2 = [0.8, 0.6, 0.9, 0.3, 0.7];

      const kappa = service.calculateCohenKappa(rater1, rater2);
      expect(kappa).toBe(1); // Perfect agreement
    });

    it("should calculate Cohen's Kappa for moderate agreement", () => {
      const rater1 = [0.8, 0.6, 0.9, 0.3, 0.7];
      const rater2 = [0.75, 0.55, 0.85, 0.4, 0.65];

      const kappa = service.calculateCohenKappa(rater1, rater2);
      expect(kappa).toBeGreaterThan(0.4); // Moderate agreement
      expect(kappa).toBeLessThan(0.8);
    });

    it('should handle no agreement beyond chance', () => {
      const rater1 = [0.1, 0.9, 0.1, 0.9, 0.1];
      const rater2 = [0.9, 0.1, 0.9, 0.1, 0.9];

      const kappa = service.calculateCohenKappa(rater1, rater2);
      expect(kappa).toBeLessThan(0); // Negative kappa indicates disagreement
    });

    it('should throw error for mismatched lengths', () => {
      const rater1 = [0.8, 0.6, 0.9];
      const rater2 = [0.8, 0.6];

      expect(() => service.calculateCohenKappa(rater1, rater2)).toThrow(
        'Rater scores must have the same length',
      );
    });

    it('should handle custom categories', () => {
      const rater1 = [0.2, 0.4, 0.6, 0.8];
      const rater2 = [0.25, 0.35, 0.65, 0.75];
      const categories = [0, 0.33, 0.67, 1.0];

      const kappa = service.calculateCohenKappa(rater1, rater2, categories);
      expect(kappa).toBeGreaterThan(0.5); // Good agreement with custom categories
    });
  });

  describe('private methods', () => {
    it("should calculate Krippendorff's alpha correctly", () => {
      const groupedScores = new Map([
        [
          'test-1',
          new Map([
            ['quality', [0.8, 0.75, 0.82]],
            ['clarity', [0.9, 0.88, 0.91]],
          ]),
        ],
        [
          'test-2',
          new Map([
            ['quality', [0.7, 0.72, 0.68]],
            ['clarity', [0.85, 0.83, 0.86]],
          ]),
        ],
      ]);

      const alpha = service['calculateKrippendorffsAlpha'](groupedScores, 'quality');
      expect(alpha).toBeGreaterThan(0.7); // High agreement
    });

    it('should bootstrap confidence intervals', async () => {
      const results: EvaluationResult[] = Array.from({ length: 20 }, (_, i) => ({
        testCaseId: `test-${i % 5}`,
        pattern: AgentPattern.SEQUENTIAL_PROCESSING,
        judgeModel: JudgeModel.GEMINI_2_5_PRO,
        metricScores: [
          {
            metric: 'quality',
            score: 7 + Math.random() * 2,
            normalizedScore: 0.7 + Math.random() * 0.2,
            reasoning: '',
          },
        ],
        overallScore: 0.8,
        pass: true,
        executionTimeMs: 100,
        timestamp: new Date(),
      }));

      const observedAlpha = 0.85;
      const [lower, upper] = await service['bootstrapConfidenceInterval'](
        results,
        observedAlpha,
        100, // Reduced for testing
        0.95,
      );

      expect(lower).toBeGreaterThanOrEqual(0);
      expect(upper).toBeLessThanOrEqual(1);
      expect(lower).toBeLessThan(upper);
    });
  });
});
