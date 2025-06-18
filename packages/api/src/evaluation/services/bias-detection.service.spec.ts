import { Test, TestingModule } from '@nestjs/testing';
import { BiasDetectionService, BiasAlert } from './bias-detection.service';
import { GoldDatasetService } from './gold-dataset.service';
import { EvaluationService } from './evaluation.service';
import { AgentPattern } from '../enums/agent-pattern.enum';
import { GoldSample } from '../interfaces/gold-dataset.interface';

describe('BiasDetectionService', () => {
  let service: BiasDetectionService;
  let goldDatasetService: jest.Mocked<GoldDatasetService>;
  let evaluationService: jest.Mocked<EvaluationService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BiasDetectionService,
        {
          provide: GoldDatasetService,
          useValue: {
            getPatternSamples: jest.fn(),
          },
        },
        {
          provide: EvaluationService,
          useValue: {
            evaluate: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BiasDetectionService>(BiasDetectionService);
    goldDatasetService = module.get(GoldDatasetService);
    evaluationService = module.get(EvaluationService);
  });

  describe('detectBias', () => {
    it('should detect length bias', async () => {
      const samples = createSamplesWithLengthBias();
      goldDatasetService.getPatternSamples.mockResolvedValue(samples);

      const report = await service.detectBias(AgentPattern.SEQUENTIAL_PROCESSING);

      expect(report.biasTypes.length.score).toBeGreaterThan(0.5);
      expect(report.biasTypes.length.effectSize).toBeDefined();
      expect(report.alerts.some((a) => a.type === 'length')).toBe(true);
    });

    it('should detect position bias', async () => {
      const samples = createSamplesWithPositionBias();
      goldDatasetService.getPatternSamples.mockResolvedValue(samples);

      const report = await service.detectBias(AgentPattern.SEQUENTIAL_PROCESSING);

      expect(report.biasTypes.position.score).toBeGreaterThan(0.3);
      expect(report.biasTypes.position.details.positionMeans).toBeDefined();
    });

    it('should detect complexity bias', async () => {
      const samples = createSamplesWithComplexityBias();
      goldDatasetService.getPatternSamples.mockResolvedValue(samples);

      const report = await service.detectBias(AgentPattern.SEQUENTIAL_PROCESSING);

      expect(report.biasTypes.complexity.score).toBeGreaterThan(0.4);
      expect(report.biasTypes.complexity.details.groupMeans).toBeDefined();
      expect(report.biasTypes.complexity.details.fStatistic).toBeGreaterThan(1);
    });

    it('should detect evaluator bias', async () => {
      const samples = createSamplesWithEvaluatorBias();
      goldDatasetService.getPatternSamples.mockResolvedValue(samples);

      const report = await service.detectBias(AgentPattern.SEQUENTIAL_PROCESSING);

      expect(report.biasTypes.evaluator.score).toBeGreaterThan(0.3);
      expect(report.biasTypes.evaluator.details.evaluatorMeans).toBeDefined();
      expect(Object.keys(report.biasTypes.evaluator.details.evaluatorMeans).length).toBeGreaterThan(
        1,
      );
    });

    it('should detect temporal bias', async () => {
      const samples = createSamplesWithTemporalBias();
      goldDatasetService.getPatternSamples.mockResolvedValue(samples);

      const report = await service.detectBias(AgentPattern.SEQUENTIAL_PROCESSING);

      expect(report.biasTypes.temporal.score).toBeGreaterThan(0.3);
      expect(report.biasTypes.temporal.details.trend).not.toBe(0);
      expect(report.biasTypes.temporal.details.windows).toBeDefined();
    });
  });

  describe('alert generation', () => {
    it('should generate appropriate alerts based on bias severity', async () => {
      const samples = createSamplesWithMultipleBiases();
      goldDatasetService.getPatternSamples.mockResolvedValue(samples);

      const report = await service.detectBias(AgentPattern.SEQUENTIAL_PROCESSING);

      const highAlerts = report.alerts.filter((a) => a.severity === 'high');
      const mediumAlerts = report.alerts.filter((a) => a.severity === 'medium');
      const lowAlerts = report.alerts.filter((a) => a.severity === 'low');

      expect(report.alerts.length).toBeGreaterThan(0);
      expect(highAlerts.every((a) => a.metric.score >= 0.7)).toBe(true);
      expect(mediumAlerts.every((a) => a.metric.score >= 0.5 && a.metric.score < 0.7)).toBe(true);
      expect(lowAlerts.every((a) => a.metric.score >= 0.3 && a.metric.score < 0.5)).toBe(true);
    });

    it('should sort alerts by severity', async () => {
      const samples = createSamplesWithMultipleBiases();
      goldDatasetService.getPatternSamples.mockResolvedValue(samples);

      const report = await service.detectBias(AgentPattern.SEQUENTIAL_PROCESSING);

      for (let i = 1; i < report.alerts.length; i++) {
        const prevSeverity = severityToNumber(report.alerts[i - 1].severity);
        const currSeverity = severityToNumber(report.alerts[i].severity);
        expect(prevSeverity).toBeLessThanOrEqual(currSeverity);
      }
    });
  });

  describe('recommendations', () => {
    it('should provide recommendations for detected biases', async () => {
      const samples = createSamplesWithLengthBias();
      goldDatasetService.getPatternSamples.mockResolvedValue(samples);

      const report = await service.detectBias(AgentPattern.SEQUENTIAL_PROCESSING);

      expect(report.recommendations.length).toBeGreaterThan(0);
      expect(report.recommendations.some((r) => r.toLowerCase().includes('length'))).toBe(true);
    });

    it('should prioritize urgent recommendations for multiple high biases', async () => {
      const samples = createSamplesWithSevereBiases();
      goldDatasetService.getPatternSamples.mockResolvedValue(samples);

      const report = await service.detectBias(AgentPattern.SEQUENTIAL_PROCESSING);

      expect(report.recommendations[0]).toContain('URGENT');
      expect(report.recommendations[0]).toContain('Multiple high-severity biases');
    });
  });

  describe('statistical calculations', () => {
    it('should correctly calculate Pearson correlation', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [2, 4, 6, 8, 10];

      const correlation = (service as any).calculatePearsonCorrelation(x, y);
      expect(correlation).toBeCloseTo(1, 5);
    });

    it('should handle zero variance in correlation', () => {
      const x = [1, 1, 1, 1, 1];
      const y = [2, 3, 4, 5, 6];

      const correlation = (service as any).calculatePearsonCorrelation(x, y);
      expect(correlation).toBe(0);
    });

    it('should calculate correlation p-value', () => {
      const r = 0.8;
      const n = 30;

      const pValue = (service as any).calculateCorrelationPValue(r, n);
      expect(pValue).toBeGreaterThanOrEqual(0);
      expect(pValue).toBeLessThanOrEqual(1);
      expect(pValue).toBeLessThan(0.05); // Significant correlation
    });
  });

  describe('overall bias score', () => {
    it('should calculate weighted overall bias score', async () => {
      const samples = createBalancedSamples();
      goldDatasetService.getPatternSamples.mockResolvedValue(samples);

      const report = await service.detectBias(AgentPattern.SEQUENTIAL_PROCESSING);

      const manualCalculation =
        report.biasTypes.length.score * 0.25 +
        report.biasTypes.position.score * 0.2 +
        report.biasTypes.complexity.score * 0.2 +
        report.biasTypes.evaluator.score * 0.2 +
        report.biasTypes.temporal.score * 0.15;

      expect(report.overallBiasScore).toBeCloseTo(manualCalculation, 5);
    });
  });
});

// Helper functions
function createSamplesWithLengthBias(): GoldSample[] {
  const samples: GoldSample[] = [];

  for (let i = 0; i < 50; i++) {
    const length = 100 + i * 20;
    const score = Math.min(10, 5 + length / 200); // Longer = higher score

    samples.push({
      id: `sample-${i}`,
      pattern: AgentPattern.SEQUENTIAL_PROCESSING,
      version: '1.0.0',
      createdAt: new Date(),
      input: { content: 'test' },
      expectedOutput: { content: 'x'.repeat(length) },
      humanScores: [
        {
          evaluatorId: 'eval1',
          timestamp: new Date(),
          scores: { overall: score },
          timeSpent: 60,
        },
      ],
      complexity: 'medium',
      edgeCase: false,
      tags: [],
    });
  }

  return samples;
}

function createSamplesWithPositionBias(): GoldSample[] {
  const samples: GoldSample[] = [];

  for (let i = 0; i < 50; i++) {
    // Early positions get higher scores
    const positionEffect = Math.max(0, 10 - i / 5);

    samples.push({
      id: `sample-${i}`,
      pattern: AgentPattern.SEQUENTIAL_PROCESSING,
      version: '1.0.0',
      createdAt: new Date(),
      input: { content: 'test' },
      expectedOutput: { content: 'output' },
      humanScores: [
        {
          evaluatorId: 'eval1',
          timestamp: new Date(),
          scores: { overall: positionEffect },
          timeSpent: 60,
        },
      ],
      complexity: 'medium',
      edgeCase: false,
      tags: [],
    });
  }

  return samples;
}

function createSamplesWithComplexityBias(): GoldSample[] {
  const samples: GoldSample[] = [];
  const complexityScores = { low: 9, medium: 7, high: 5 };

  ['low', 'medium', 'high'].forEach((complexity) => {
    for (let i = 0; i < 20; i++) {
      samples.push({
        id: `sample-${complexity}-${i}`,
        pattern: AgentPattern.SEQUENTIAL_PROCESSING,
        version: '1.0.0',
        createdAt: new Date(),
        input: { content: 'test' },
        expectedOutput: { content: 'output' },
        humanScores: [
          {
            evaluatorId: 'eval1',
            timestamp: new Date(),
            scores: {
              overall:
                complexityScores[complexity as keyof typeof complexityScores] +
                (Math.random() - 0.5),
            },
            timeSpent: 60,
          },
        ],
        complexity: complexity as any,
        edgeCase: false,
        tags: [],
      });
    }
  });

  return samples;
}

function createSamplesWithEvaluatorBias(): GoldSample[] {
  const samples: GoldSample[] = [];
  const evaluatorBiases = { eval1: 8, eval2: 6, eval3: 7 };

  for (let i = 0; i < 30; i++) {
    samples.push({
      id: `sample-${i}`,
      pattern: AgentPattern.SEQUENTIAL_PROCESSING,
      version: '1.0.0',
      createdAt: new Date(),
      input: { content: 'test' },
      expectedOutput: { content: 'output' },
      humanScores: Object.entries(evaluatorBiases).map(([evalId, bias]) => ({
        evaluatorId: evalId,
        timestamp: new Date(),
        scores: { overall: bias + (Math.random() - 0.5) * 2 },
        timeSpent: 60,
      })),
      complexity: 'medium',
      edgeCase: false,
      tags: [],
    });
  }

  return samples;
}

function createSamplesWithTemporalBias(): GoldSample[] {
  const samples: GoldSample[] = [];
  const startDate = new Date('2024-01-01');

  for (let i = 0; i < 50; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);

    // Score increases over time
    const score = 5 + i / 10;

    samples.push({
      id: `sample-${i}`,
      pattern: AgentPattern.SEQUENTIAL_PROCESSING,
      version: '1.0.0',
      createdAt: date,
      input: { content: 'test' },
      expectedOutput: { content: 'output' },
      humanScores: [
        {
          evaluatorId: 'eval1',
          timestamp: date,
          scores: { overall: score },
          timeSpent: 60,
        },
      ],
      complexity: 'medium',
      edgeCase: false,
      tags: [],
    });
  }

  return samples;
}

function createSamplesWithMultipleBiases(): GoldSample[] {
  return [
    ...createSamplesWithLengthBias().slice(0, 10),
    ...createSamplesWithComplexityBias().slice(0, 10),
    ...createSamplesWithEvaluatorBias().slice(0, 10),
  ];
}

function createSamplesWithSevereBiases(): GoldSample[] {
  const samples: GoldSample[] = [];

  // Create samples with extreme biases
  for (let i = 0; i < 30; i++) {
    const length = i < 15 ? 50 : 2000;
    const score = i < 15 ? 3 : 9;

    samples.push({
      id: `sample-${i}`,
      pattern: AgentPattern.SEQUENTIAL_PROCESSING,
      version: '1.0.0',
      createdAt: new Date(),
      input: { content: 'test' },
      expectedOutput: { content: 'x'.repeat(length) },
      humanScores: [
        {
          evaluatorId: i < 15 ? 'harsh' : 'lenient',
          timestamp: new Date(),
          scores: { overall: score },
          timeSpent: 60,
        },
      ],
      complexity: i < 10 ? 'low' : i < 20 ? 'medium' : 'high',
      edgeCase: false,
      tags: [],
    });
  }

  return samples;
}

function createBalancedSamples(): GoldSample[] {
  const samples: GoldSample[] = [];

  for (let i = 0; i < 60; i++) {
    samples.push({
      id: `sample-${i}`,
      pattern: AgentPattern.SEQUENTIAL_PROCESSING,
      version: '1.0.0',
      createdAt: new Date(),
      input: { content: 'test' },
      expectedOutput: { content: 'output' },
      humanScores: [
        {
          evaluatorId: `eval${i % 3}`,
          timestamp: new Date(),
          scores: { overall: 7 + (Math.random() - 0.5) * 2 },
          timeSpent: 60,
        },
      ],
      complexity: ['low', 'medium', 'high'][i % 3] as any,
      edgeCase: i % 10 === 0,
      tags: [],
    });
  }

  return samples;
}

function severityToNumber(severity: BiasAlert['severity']): number {
  const map = { high: 0, medium: 1, low: 2 };
  return map[severity];
}
