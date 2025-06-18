import { Test, TestingModule } from '@nestjs/testing';
import { CalibrationService } from './calibration.service';
import { GoldDatasetService } from './gold-dataset.service';
import { LlmJudgeService } from './llm-judge.service';
import { EvaluationConfigService } from './evaluation-config.service';
import { AgentPattern } from '../enums/agent-pattern.enum';
import { GoldSample, HumanScore } from '../interfaces/gold-dataset.interface';

describe('CalibrationService', () => {
  let service: CalibrationService;
  let goldDatasetService: jest.Mocked<GoldDatasetService>;
  let llmJudgeService: jest.Mocked<LlmJudgeService>;
  let configService: jest.Mocked<EvaluationConfigService>;

  const mockGoldSamples: GoldSample[] = [
    {
      id: '1',
      pattern: AgentPattern.SEQUENTIAL_PROCESSING,
      version: '1.0.0',
      createdAt: new Date(),
      input: { content: 'Test input 1' },
      expectedOutput: { content: 'Test output 1' },
      humanScores: [
        {
          evaluatorId: 'eval1',
          timestamp: new Date(),
          scores: { overall: 8, accuracy: 8, coherence: 8 },
          timeSpent: 60,
        },
        {
          evaluatorId: 'eval2',
          timestamp: new Date(),
          scores: { overall: 7, accuracy: 7, coherence: 8 },
          timeSpent: 45,
        },
      ],
      complexity: 'medium',
      edgeCase: false,
      tags: [],
    },
    // Add more samples for testing
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalibrationService,
        {
          provide: GoldDatasetService,
          useValue: {
            getPatternSamples: jest.fn(),
            addHumanScore: jest.fn(),
          },
        },
        {
          provide: LlmJudgeService,
          useValue: {
            evaluate: jest.fn(),
          },
        },
        {
          provide: EvaluationConfigService,
          useValue: {
            getConfig: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CalibrationService>(CalibrationService);
    goldDatasetService = module.get(GoldDatasetService);
    llmJudgeService = module.get(LlmJudgeService);
    configService = module.get(EvaluationConfigService);
  });

  describe('calibratePattern', () => {
    it('should calibrate weights for a pattern', async () => {
      // Generate more test samples
      const testSamples = generateTestSamples(50);
      goldDatasetService.getPatternSamples.mockResolvedValue(testSamples);

      // Mock LLM evaluations
      llmJudgeService.evaluate.mockImplementation(async () => ({
        metricScores: [
          { metric: 'accuracy', score: 7, normalizedScore: 0.7 },
          { metric: 'coherence', score: 8, normalizedScore: 0.8 },
          { metric: 'completeness', score: 7.5, normalizedScore: 0.75 },
          { metric: 'relevance', score: 8, normalizedScore: 0.8 },
          { metric: 'efficiency', score: 7, normalizedScore: 0.7 },
        ],
        details: {
          actualOutput: {},
          chainOfThought: [],
        },
      }));

      const result = await service.calibratePattern(AgentPattern.SEQUENTIAL_PROCESSING, {
        maxIterations: 10,
        learningRate: 0.01,
      });

      expect(result).toBeDefined();
      expect(result.pattern).toBe(AgentPattern.SEQUENTIAL_PROCESSING);
      expect(result.weights).toBeDefined();
      expect(result.spearmanCorrelation).toBeGreaterThanOrEqual(-1);
      expect(result.spearmanCorrelation).toBeLessThanOrEqual(1);
      expect(result.krippendorffAlpha).toBeDefined();
      expect(result.confidenceInterval).toBeDefined();
      expect(result.validationMetrics).toBeDefined();
    });

    it('should throw error with insufficient samples', async () => {
      goldDatasetService.getPatternSamples.mockResolvedValue(
        generateTestSamples(10), // Less than required 30
      );

      await expect(service.calibratePattern(AgentPattern.SEQUENTIAL_PROCESSING)).rejects.toThrow(
        'Insufficient samples for calibration',
      );
    });

    it('should converge early when threshold is met', async () => {
      const testSamples = generateTestSamples(50);
      goldDatasetService.getPatternSamples.mockResolvedValue(testSamples);

      let evaluationCount = 0;
      llmJudgeService.evaluate.mockImplementation(async () => {
        evaluationCount++;
        // Return scores that will quickly converge
        return {
          metricScores: [
            { metric: 'accuracy', score: 7, normalizedScore: 0.7 },
            { metric: 'coherence', score: 8, normalizedScore: 0.8 },
            { metric: 'completeness', score: 7.5, normalizedScore: 0.75 },
            { metric: 'relevance', score: 8, normalizedScore: 0.8 },
            { metric: 'efficiency', score: 7, normalizedScore: 0.7 },
          ],
          details: {
            actualOutput: {},
            chainOfThought: [],
          },
        };
      });

      const result = await service.calibratePattern(AgentPattern.SEQUENTIAL_PROCESSING, {
        maxIterations: 100,
        convergenceThreshold: 0.5, // High threshold for quick convergence
      });

      expect(evaluationCount).toBeLessThan(100 * 50); // Should converge before max iterations
    });
  });

  describe('evaluateWithCalibration', () => {
    it('should apply calibrated weights to evaluation', async () => {
      const mockCalibration = {
        timestamp: new Date(),
        pattern: AgentPattern.SEQUENTIAL_PROCESSING,
        weights: {
          accuracy: 0.4,
          coherence: 0.3,
          completeness: 0.2,
          relevance: 0.1,
        },
        spearmanCorrelation: 0.8,
        krippendorffAlpha: 0.75,
        confidenceInterval: { lower: 0.7, upper: 0.9 },
        validationMetrics: { mse: 0.5, mae: 0.3, bias: 0.1 },
      };

      // Mock calibration retrieval
      jest.spyOn(service as any, 'getCalibration').mockResolvedValue(mockCalibration);

      llmJudgeService.evaluate.mockResolvedValue({
        metricScores: [
          { metric: 'accuracy', score: 8, normalizedScore: 0.8 },
          { metric: 'coherence', score: 7, normalizedScore: 0.7 },
          { metric: 'completeness', score: 6, normalizedScore: 0.6 },
          { metric: 'relevance', score: 9, normalizedScore: 0.9 },
        ],
        details: {
          actualOutput: {},
          chainOfThought: [],
        },
      });

      const score = await service.evaluateWithCalibration(
        AgentPattern.SEQUENTIAL_PROCESSING,
        'test input',
        'test output',
      );

      expect(score).toBeDefined();
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(10);
    });

    it('should apply length normalization', async () => {
      jest.spyOn(service as any, 'getCalibration').mockResolvedValue({
        timestamp: new Date(),
        pattern: AgentPattern.SEQUENTIAL_PROCESSING,
        weights: { accuracy: 1 },
        spearmanCorrelation: 0.8,
        krippendorffAlpha: 0.75,
        confidenceInterval: { lower: 0.7, upper: 0.9 },
        validationMetrics: { mse: 0.5, mae: 0.3, bias: 0.1 },
      });

      llmJudgeService.evaluate.mockResolvedValue({
        metricScores: [
          { metric: 'accuracy', score: 8, normalizedScore: 0.8 },
        ],
        details: {
          actualOutput: {},
          chainOfThought: [],
        },
      });

      const shortOutput = 'Short';
      const longOutput = 'A'.repeat(1000);

      const shortScore = await service.evaluateWithCalibration(
        AgentPattern.SEQUENTIAL_PROCESSING,
        'input',
        shortOutput,
      );

      const longScore = await service.evaluateWithCalibration(
        AgentPattern.SEQUENTIAL_PROCESSING,
        'input',
        longOutput,
      );

      // Both scores should be defined but potentially different due to length normalization
      expect(shortScore).toBeDefined();
      expect(longScore).toBeDefined();
    });
  });

  describe('Spearman correlation calculation', () => {
    it('should calculate correct Spearman correlation', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [2, 4, 6, 8, 10];

      const correlation = (service as any).calculateSpearmanCorrelation(x, y);
      expect(correlation).toBeCloseTo(1, 2); // Perfect positive correlation
    });

    it('should handle negative correlation', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [10, 8, 6, 4, 2];

      const correlation = (service as any).calculateSpearmanCorrelation(x, y);
      expect(correlation).toBeCloseTo(-1, 2); // Perfect negative correlation
    });

    it('should handle tied ranks', () => {
      const x = [1, 2, 2, 4, 5];
      const y = [2, 3, 3, 5, 6];

      const correlation = (service as any).calculateSpearmanCorrelation(x, y);
      expect(correlation).toBeGreaterThan(0.9); // Strong positive correlation despite ties
    });
  });

  describe('Krippendorff alpha calculation', () => {
    it('should calculate alpha for perfect agreement', () => {
      const samples: GoldSample[] = [
        createSampleWithScores([8, 8, 8]),
        createSampleWithScores([7, 7, 7]),
        createSampleWithScores([9, 9, 9]),
      ];

      const alpha = (service as any).calculateKrippendorffAlpha(samples);
      expect(alpha).toBeCloseTo(1, 1); // Perfect agreement
    });

    it('should calculate alpha for disagreement', () => {
      const samples: GoldSample[] = [
        createSampleWithScores([1, 10]),
        createSampleWithScores([2, 9]),
        createSampleWithScores([3, 8]),
      ];

      const alpha = (service as any).calculateKrippendorffAlpha(samples);
      expect(alpha).toBeLessThan(0.5); // Low agreement
    });
  });

  describe('Bootstrap confidence intervals', () => {
    it('should calculate confidence intervals', () => {
      const humanScores = [7, 8, 6, 9, 7, 8, 7, 8, 9, 7];
      const llmScores = [7.5, 8.2, 6.1, 8.8, 7.2, 8.1, 7.3, 8.0, 8.9, 7.1];

      const ci = (service as any).bootstrapConfidenceInterval(humanScores, llmScores, 100, 0.95);

      expect(ci.lower).toBeLessThan(ci.upper);
      expect(ci.lower).toBeGreaterThanOrEqual(-1);
      expect(ci.upper).toBeLessThanOrEqual(1);
    });
  });

  describe('Weight optimization', () => {
    it('should update weights based on gradient', () => {
      const currentWeights = {
        accuracy: 0.25,
        coherence: 0.25,
        completeness: 0.25,
        relevance: 0.25,
      };

      const humanScores = [7, 8, 6, 9];
      const llmScores = [6.5, 8.5, 6.5, 8.5];

      const newWeights = (service as any).updateWeights(
        currentWeights,
        humanScores,
        llmScores,
        0.1,
      );

      // Weights should be normalized (sum to 1)
      const sum = Object.values(newWeights).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 5);

      // All weights should be between 0 and 1
      Object.values(newWeights).forEach((weight) => {
        expect(weight).toBeGreaterThanOrEqual(0);
        expect(weight).toBeLessThanOrEqual(1);
      });
    });
  });
});

// Helper functions
function generateTestSamples(count: number): GoldSample[] {
  const samples: GoldSample[] = [];

  for (let i = 0; i < count; i++) {
    const baseScore = 5 + Math.random() * 5; // 5-10 range
    const variation = Math.random() * 2 - 1; // ±1 variation

    samples.push({
      id: `sample-${i}`,
      pattern: AgentPattern.SEQUENTIAL_PROCESSING,
      version: '1.0.0',
      createdAt: new Date(),
      input: { content: `Test input ${i}` },
      expectedOutput: { content: `Test output ${i}` },
      humanScores: [
        {
          evaluatorId: 'eval1',
          timestamp: new Date(),
          scores: { overall: baseScore + variation * 0.5 },
          timeSpent: 30 + Math.random() * 60,
        },
        {
          evaluatorId: 'eval2',
          timestamp: new Date(),
          scores: { overall: baseScore - variation * 0.5 },
          timeSpent: 30 + Math.random() * 60,
        },
      ],
      complexity: ['low', 'medium', 'high'][i % 3] as any,
      edgeCase: i % 10 === 0,
      tags: [],
    });
  }

  return samples;
}

function createSampleWithScores(scores: number[]): GoldSample {
  return {
    id: 'test',
    pattern: AgentPattern.SEQUENTIAL_PROCESSING,
    version: '1.0.0',
    createdAt: new Date(),
    input: { content: 'test' },
    humanScores: scores.map((score, i) => ({
      evaluatorId: `eval${i}`,
      timestamp: new Date(),
      scores: { overall: score },
      timeSpent: 60,
    })),
    complexity: 'medium',
    edgeCase: false,
    tags: [],
  };
}
