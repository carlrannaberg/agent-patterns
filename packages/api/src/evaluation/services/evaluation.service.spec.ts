import { Test, TestingModule } from '@nestjs/testing';
import { EvaluationService } from './evaluation.service';
import { LlmJudgeService } from './llm-judge.service';
import { GEvalService } from './g-eval.service';
import { TestCaseService } from './test-case.service';
import { ReliabilityService } from './reliability.service';
import { EvaluationConfigService } from './evaluation-config.service';
import { TestCase, EvaluationConfig, MetricScore } from '../interfaces/evaluation.interface';
import { AgentPattern } from '../enums/agent-pattern.enum';
import { JudgeModel } from '../enums/judge-model.enum';

describe('EvaluationService', () => {
  let service: EvaluationService;
  let llmJudgeService: jest.Mocked<LlmJudgeService>;
  let gEvalService: jest.Mocked<GEvalService>;
  let testCaseService: jest.Mocked<TestCaseService>;
  let reliabilityService: jest.Mocked<ReliabilityService>;
  let configService: jest.Mocked<EvaluationConfigService>;

  const mockConfig: EvaluationConfig = {
    pattern: AgentPattern.SEQUENTIAL_PROCESSING,
    judgeModel: JudgeModel.GEMINI_2_5_PRO,
    metrics: [
      {
        name: 'quality',
        description: 'Content quality',
        scoreRange: [1, 10],
        weight: 2,
      },
      {
        name: 'clarity',
        description: 'Clarity of message',
        scoreRange: [1, 10],
        weight: 1,
      },
    ],
    enableReliabilityChecks: true,
  };

  const mockTestCase: TestCase = {
    id: 'test-1',
    pattern: AgentPattern.SEQUENTIAL_PROCESSING,
    input: { prompt: 'Create marketing copy' },
    expectedOutput: { content: 'Expected output' },
  };

  const mockMetricScores: MetricScore[] = [
    {
      metric: 'quality',
      score: 8,
      normalizedScore: 0.778,
      reasoning: 'Good quality',
    },
    {
      metric: 'clarity',
      score: 9,
      normalizedScore: 0.889,
      reasoning: 'Very clear',
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EvaluationService,
        {
          provide: LlmJudgeService,
          useValue: {
            evaluate: jest.fn(),
          },
        },
        {
          provide: GEvalService,
          useValue: {
            evaluateWithGEval: jest.fn(),
          },
        },
        {
          provide: TestCaseService,
          useValue: {
            getTestCasesByPattern: jest.fn(),
          },
        },
        {
          provide: ReliabilityService,
          useValue: {
            calculateReliability: jest.fn(),
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

    service = module.get<EvaluationService>(EvaluationService);
    llmJudgeService = module.get(LlmJudgeService);
    gEvalService = module.get(GEvalService);
    testCaseService = module.get(TestCaseService);
    reliabilityService = module.get(ReliabilityService);
    configService = module.get(EvaluationConfigService);

    // Setup default mocks
    configService.getConfig.mockReturnValue(mockConfig);
    llmJudgeService.evaluate.mockResolvedValue({
      metricScores: mockMetricScores,
      details: {
        actualOutput: { content: 'Actual output' },
        chainOfThought: ['Step 1', 'Step 2'],
      },
    });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('evaluateSingle', () => {
    it('should evaluate a single test case successfully', async () => {
      const actualOutput = { content: 'Buy now!' };
      const result = await service.evaluateSingle(mockTestCase, actualOutput);

      expect(result).toBeDefined();
      expect(result.testCaseId).toBe('test-1');
      expect(result.pattern).toBe(AgentPattern.SEQUENTIAL_PROCESSING);
      expect(result.metricScores).toHaveLength(2);
      expect(result.overallScore).toBeCloseTo(0.815, 2); // Weighted average
      expect(result.pass).toBe(true);
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should use G-Eval when rubric path is provided', async () => {
      const configWithRubric = { ...mockConfig, rubricPath: '/path/to/rubric' };
      configService.getConfig.mockReturnValueOnce(configWithRubric);

      gEvalService.evaluateWithGEval.mockResolvedValue(mockMetricScores[0]);

      const result = await service.evaluateSingle(mockTestCase, { content: 'Test' });

      expect(gEvalService.evaluateWithGEval).toHaveBeenCalledTimes(2); // Once per metric
      expect(result.details?.evaluationMethod).toBe('G-Eval');
    });

    it('should handle evaluation errors gracefully', async () => {
      llmJudgeService.evaluate.mockRejectedValueOnce(new Error('Evaluation failed'));

      const result = await service.evaluateSingle(mockTestCase, { content: 'Test' });

      expect(result.pass).toBe(false);
      expect(result.overallScore).toBe(0);
      expect(result.error).toBe('Evaluation failed');
    });

    it('should fail binary checks', async () => {
      const configWithBinary = {
        ...mockConfig,
        metrics: [
          {
            name: 'has_cta',
            description: 'Has call to action',
            scoreRange: [0, 1] as [number, number],
            binaryCheck: true,
          },
        ],
      };
      configService.getConfig.mockReturnValueOnce(configWithBinary);

      llmJudgeService.evaluate.mockResolvedValueOnce({
        metricScores: [
          {
            metric: 'has_cta',
            score: 0,
            normalizedScore: 0,
            reasoning: 'No CTA found',
          },
        ],
        details: {
          actualOutput: { content: 'Test' },
        },
      });

      const result = await service.evaluateSingle(mockTestCase, { content: 'Test' });

      expect(result.pass).toBe(false);
    });
  });

  describe('evaluateBatch', () => {
    const testCases: TestCase[] = [
      mockTestCase,
      { ...mockTestCase, id: 'test-2' },
      { ...mockTestCase, id: 'test-3' },
    ];

    const actualOutputs = new Map([
      ['test-1', { content: 'Output 1' }],
      ['test-2', { content: 'Output 2' }],
      ['test-3', { content: 'Output 3' }],
    ]);

    it('should evaluate multiple test cases in batch', async () => {
      const mockReliabilityMetrics = {
        krippendorffsAlpha: 0.85,
        interRaterAgreement: 0.9,
        confidenceInterval: [0.8, 0.9] as [number, number],
        sampleSize: 3,
      };
      reliabilityService.calculateReliability.mockResolvedValueOnce(mockReliabilityMetrics);

      const result = await service.evaluateBatch(
        AgentPattern.SEQUENTIAL_PROCESSING,
        testCases,
        actualOutputs,
      );

      expect(result).toBeDefined();
      expect(result.batchId).toContain('batch-');
      expect(result.results).toHaveLength(3);
      expect(result.summary.totalTestCases).toBe(3);
      expect(result.summary.passedTestCases).toBe(3);
      expect(result.summary.reliabilityMetrics).toEqual(mockReliabilityMetrics);
    });

    it('should handle missing outputs gracefully', async () => {
      const incompleteOutputs = new Map([
        ['test-1', { content: 'Output 1' }],
        // test-2 is missing
        ['test-3', { content: 'Output 3' }],
      ]);

      const result = await service.evaluateBatch(
        AgentPattern.SEQUENTIAL_PROCESSING,
        testCases,
        incompleteOutputs,
      );

      expect(result.results).toHaveLength(2); // Only successful evaluations
      expect(result.summary.totalTestCases).toBe(2);
    });

    it('should process in batches', async () => {
      const manyTestCases = Array.from({ length: 12 }, (_, i) => ({
        ...mockTestCase,
        id: `test-${i}`,
      }));

      const manyOutputs = new Map(
        manyTestCases.map((tc) => [tc.id, { content: `Output ${tc.id}` }]),
      );

      const configWithSmallBatch = { ...mockConfig, batchSize: 3 };
      configService.getConfig.mockReturnValue(configWithSmallBatch);

      await service.evaluateBatch(AgentPattern.SEQUENTIAL_PROCESSING, manyTestCases, manyOutputs);

      // Should be called once per test case
      expect(llmJudgeService.evaluate).toHaveBeenCalledTimes(12);
    });
  });

  describe('evaluatePattern', () => {
    const mockExecutionFunction = jest.fn();

    beforeEach(() => {
      testCaseService.getTestCasesByPattern.mockResolvedValue([
        mockTestCase,
        { ...mockTestCase, id: 'test-2' },
      ]);

      mockExecutionFunction.mockImplementation(async (input: any) => ({
        content: `Processed: ${(input as { prompt: string }).prompt}`,
      }));
    });

    it('should evaluate a pattern with execution function', async () => {
      const result = await service.evaluatePattern(
        AgentPattern.SEQUENTIAL_PROCESSING,
        mockExecutionFunction,
      );

      expect(testCaseService.getTestCasesByPattern).toHaveBeenCalledWith(
        AgentPattern.SEQUENTIAL_PROCESSING,
        expect.objectContaining({ random: true }),
      );
      expect(mockExecutionFunction).toHaveBeenCalledTimes(2);
      expect(result.results).toHaveLength(2);
    });

    it('should apply test case filters', async () => {
      await service.evaluatePattern(AgentPattern.SEQUENTIAL_PROCESSING, mockExecutionFunction, {
        testCaseLimit: 5,
        testCaseFilter: {
          difficulty: 'medium',
          category: 'content-generation',
          tags: ['marketing'],
        },
      });

      expect(testCaseService.getTestCasesByPattern).toHaveBeenCalledWith(
        AgentPattern.SEQUENTIAL_PROCESSING,
        {
          difficulty: 'medium',
          category: 'content-generation',
          tags: ['marketing'],
          limit: 5,
          random: true,
        },
      );
    });

    it('should handle execution errors', async () => {
      mockExecutionFunction
        .mockResolvedValueOnce({ content: 'Success' })
        .mockRejectedValueOnce(new Error('Execution failed'));

      const result = await service.evaluatePattern(
        AgentPattern.SEQUENTIAL_PROCESSING,
        mockExecutionFunction,
      );

      expect(result.results).toHaveLength(2);
      // One should have an error in actualOutput
      const errorResult = result.results.find((r) => r.testCaseId === 'test-2');
      expect(errorResult).toBeDefined();
    });

    it('should throw error when no test cases found', async () => {
      testCaseService.getTestCasesByPattern.mockResolvedValueOnce([]);

      await expect(
        service.evaluatePattern(AgentPattern.SEQUENTIAL_PROCESSING, mockExecutionFunction),
      ).rejects.toThrow('No test cases found');
    });
  });

  describe('private methods', () => {
    it('should calculate overall score with weights', () => {
      const scores: MetricScore[] = [
        { metric: 'quality', score: 8, normalizedScore: 0.8, reasoning: '' },
        { metric: 'clarity', score: 6, normalizedScore: 0.6, reasoning: '' },
      ];

      const config: EvaluationConfig = {
        ...mockConfig,
        metrics: [
          { name: 'quality', description: '', scoreRange: [0, 10] as [number, number], weight: 3 },
          { name: 'clarity', description: '', scoreRange: [0, 10] as [number, number], weight: 1 },
        ],
      };

      const overallScore = service['calculateOverallScore'](scores, config);
      // (0.8 * 3 + 0.6 * 1) / (3 + 1) = 3.0 / 4 = 0.75
      expect(overallScore).toBeCloseTo(0.75, 2);
    });

    it('should determine pass based on threshold', () => {
      const scores: MetricScore[] = [
        { metric: 'quality', score: 6, normalizedScore: 0.6, reasoning: '' },
      ];

      const config: EvaluationConfig = {
        ...mockConfig,
        metrics: [{ name: 'quality', description: '', scoreRange: [1, 10] as [number, number] }],
      };

      const pass = service['determinePass'](scores, 0.6, config);
      expect(pass).toBe(false); // Default threshold is 0.7
    });
  });
});
