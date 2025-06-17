import { Test, TestingModule } from '@nestjs/testing';
import { LlmJudgeService } from './llm-judge.service';
import { TestCase, EvaluationConfig } from '../interfaces/evaluation.interface';
import { AgentPattern } from '../enums/agent-pattern.enum';
import { JudgeModel } from '../enums/judge-model.enum';

// Mock the AI SDK
jest.mock('@ai-sdk/google', () => ({
  google: jest.fn(() => 'mock-model'),
}));

jest.mock('ai', () => ({
  generateObject: jest.fn(),
}));

const { generateObject } = require('ai');

describe('LlmJudgeService', () => {
  let service: LlmJudgeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LlmJudgeService],
    }).compile();

    service = module.get<LlmJudgeService>(LlmJudgeService);

    // Reset mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('evaluate', () => {
    const mockTestCase: TestCase = {
      id: 'test-1',
      pattern: AgentPattern.SEQUENTIAL_PROCESSING,
      input: { prompt: 'Test input' },
      expectedOutput: { content: 'Expected output' },
    };

    const mockConfig: EvaluationConfig = {
      pattern: AgentPattern.SEQUENTIAL_PROCESSING,
      judgeModel: JudgeModel.GEMINI_2_5_PRO,
      metrics: [
        {
          name: 'quality',
          description: 'Overall quality',
          scoreRange: [1, 10],
        },
      ],
    };

    it('should evaluate a test case successfully', async () => {
      generateObject.mockResolvedValueOnce({
        object: {
          metricScores: [
            {
              metric: 'quality',
              score: 8,
              reasoning: 'Good quality output',
              confidence: 0.9,
            },
          ],
          chainOfThought: ['Step 1', 'Step 2'],
          overallAssessment: 'Good performance',
        },
      });

      const actualOutput = { content: 'Actual output' };
      const result = await service.evaluate(mockTestCase, actualOutput, mockConfig);

      expect(result).toBeDefined();
      expect(result.metricScores).toHaveLength(1);
      expect(result.metricScores[0]).toMatchObject({
        metric: 'quality',
        score: 8,
        normalizedScore: expect.any(Number),
        reasoning: 'Good quality output',
      });
      expect(result.details).toBeDefined();
      expect(result.details.actualOutput).toBe(actualOutput);
    });

    it('should normalize scores correctly', async () => {
      generateObject.mockResolvedValueOnce({
        object: {
          metricScores: [
            {
              metric: 'quality',
              score: 8,
              reasoning: 'Good quality output',
              confidence: 0.9,
            },
          ],
          chainOfThought: ['Step 1', 'Step 2'],
          overallAssessment: 'Good performance',
        },
      });

      const actualOutput = { content: 'Test' };
      const result = await service.evaluate(mockTestCase, actualOutput, mockConfig);

      const normalizedScore = result.metricScores[0].normalizedScore;
      expect(normalizedScore).toBeGreaterThanOrEqual(0);
      expect(normalizedScore).toBeLessThanOrEqual(1);
      // Score 8 on 1-10 scale should normalize to 0.777...
      expect(normalizedScore).toBeCloseTo(0.778, 2);
    });

    it('should handle binary checks', async () => {
      const binaryConfig: EvaluationConfig = {
        ...mockConfig,
        metrics: [
          {
            name: 'has_cta',
            description: 'Has call to action',
            scoreRange: [0, 1],
            binaryCheck: true,
          },
        ],
      };

      generateObject.mockResolvedValueOnce({
        object: {
          metricScores: [
            {
              metric: 'has_cta',
              score: 1,
              reasoning: 'Contains call to action',
              confidence: 1.0,
            },
          ],
          chainOfThought: ['Found Buy now! CTA'],
          overallAssessment: 'Has clear CTA',
        },
      });

      const result = await service.evaluate(mockTestCase, { content: 'Buy now!' }, binaryConfig);

      expect(result.metricScores[0].normalizedScore).toBe(1);
    });
  });

  describe('evaluateWithRubric', () => {
    it('should evaluate with rubric steps', async () => {
      // Mock generateObject to return rubric step results
      generateObject
        .mockResolvedValueOnce({
          object: { evaluation: 'Step 1 evaluation', score: 8 },
        })
        .mockResolvedValueOnce({
          object: { evaluation: 'Step 2 evaluation', score: 7 },
        })
        .mockResolvedValueOnce({
          object: { evaluation: 'Step 3 evaluation', score: 9 },
        });

      const mockTestCase: TestCase = {
        id: 'test-1',
        pattern: AgentPattern.SEQUENTIAL_PROCESSING,
        input: { prompt: 'Test' },
      };

      const rubricSteps = ['Check content quality', 'Verify accuracy', 'Assess clarity'];

      const mockConfig: EvaluationConfig = {
        pattern: AgentPattern.SEQUENTIAL_PROCESSING,
        judgeModel: JudgeModel.GEMINI_2_5_PRO,
        metrics: [],
      };

      // Reset the mock for rubric evaluation
      generateObject.mockReset();
      generateObject.mockImplementation(async () => ({
        object: {
          evaluation: 'Good performance on this step',
          score: 7,
        },
      }));

      const result = await service.evaluateWithRubric(
        mockTestCase,
        { content: 'Output' },
        rubricSteps,
        mockConfig,
      );

      expect(result.rubricScores).toHaveLength(3);
      expect(result.aggregatedScore).toBe(7);
      expect(result.rubricScores[0]).toMatchObject({
        step: 1,
        description: 'Check content quality',
        evaluation: 'Good performance on this step',
        score: 7,
      });
    });
  });

  describe('getJudgeModel', () => {
    it('should return Google model for Gemini', () => {
      const model = service['getJudgeModel'](JudgeModel.GEMINI_2_5_PRO);
      expect(model).toBe('mock-model');
    });

    it('should throw error for unsupported providers', () => {
      expect(() => service['getJudgeModel'](JudgeModel.GPT_4O)).toThrow(
        'OpenAI provider not yet implemented',
      );
    });
  });

  describe('buildEvaluationPrompt', () => {
    it('should build comprehensive evaluation prompt', () => {
      const testCase: TestCase = {
        id: 'test-1',
        pattern: AgentPattern.SEQUENTIAL_PROCESSING,
        input: { prompt: 'Create marketing copy' },
        expectedOutput: { content: 'Expected copy' },
        context: { target: 'developers' },
      };

      const config: EvaluationConfig = {
        pattern: AgentPattern.SEQUENTIAL_PROCESSING,
        judgeModel: JudgeModel.GEMINI_2_5_PRO,
        metrics: [
          {
            name: 'quality',
            description: 'Content quality',
            scoreRange: [1, 10],
          },
        ],
      };

      const prompt = service['buildEvaluationPrompt'](testCase, { content: 'Actual copy' }, config);

      expect(prompt).toContain('Test Case Input:');
      expect(prompt).toContain('Expected Output:');
      expect(prompt).toContain('Actual Output:');
      expect(prompt).toContain('Additional Context:');
      expect(prompt).toContain('quality: Content quality');
    });
  });
});
