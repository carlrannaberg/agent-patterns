import { Test, TestingModule } from '@nestjs/testing';
import { GEvalService } from './g-eval.service';
import { TestCase, EvaluationConfig } from '../interfaces/evaluation.interface';
import { AgentPattern } from '../enums/agent-pattern.enum';
import { JudgeModel } from '../enums/judge-model.enum';

// Mock the AI SDK
jest.mock('@ai-sdk/google', () => ({
  google: jest.fn(() => 'mock-model'),
}));

jest.mock('ai', () => ({
  generateObject: jest.fn(),
  generateText: jest.fn(),
}));

describe('GEvalService', () => {
  let service: GEvalService;
  let generateObject: jest.Mock;
  let generateText: jest.Mock;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GEvalService],
    }).compile();

    service = module.get<GEvalService>(GEvalService);

    // Get mocked functions
    const aiModule = require('ai');
    generateObject = aiModule.generateObject;
    generateText = aiModule.generateText;

    // Reset mocks
    generateObject.mockReset();
    generateText.mockReset();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('evaluateWithGEval', () => {
    const mockTestCase: TestCase = {
      id: 'test-1',
      pattern: AgentPattern.SEQUENTIAL_PROCESSING,
      input: { prompt: 'Create marketing copy' },
      context: { audience: 'developers' },
    };

    const mockConfig: EvaluationConfig = {
      pattern: AgentPattern.SEQUENTIAL_PROCESSING,
      judgeModel: JudgeModel.GEMINI_2_5_PRO,
      metrics: [
        {
          name: 'quality',
          description: 'Content quality and coherence',
          scoreRange: [1, 10],
        },
      ],
    };

    beforeEach(() => {
      // Mock generateObject for evaluation steps
      generateObject.mockResolvedValueOnce({
        object: {
          steps: [
            'Check content addresses the prompt',
            'Evaluate clarity and coherence',
            'Assess engagement and persuasiveness',
          ],
          binaryChecks: ['Is there a clear call to action?'],
        },
      });

      // Mock generateText for binary checks
      generateText.mockResolvedValueOnce({
        text: 'Does the content target developers? \n Is the tone appropriate?',
      });

      // Mock generateObject for final evaluation
      generateObject.mockResolvedValueOnce({
        object: {
          score: 8,
          reasoning: 'Strong content with good clarity',
          stepResults: [
            {
              step: 'Check content addresses the prompt',
              result: 'Content fully addresses the marketing copy request',
              passed: true,
            },
            {
              step: 'Evaluate clarity and coherence',
              result: 'Clear and well-structured',
              passed: true,
            },
            {
              step: 'Assess engagement and persuasiveness',
              result: 'Good emotional appeal',
              passed: true,
            },
          ],
        },
      });
    });

    it('should perform G-Eval successfully', async () => {
      const actualOutput = { content: 'Buy our product!' };
      const result = await service.evaluateWithGEval(
        mockTestCase,
        actualOutput,
        'quality',
        mockConfig,
      );

      expect(result).toBeDefined();
      expect(result.metric).toBe('quality');
      expect(result.score).toBe(8);
      expect(result.normalizedScore).toBeCloseTo(0.778, 2); // (8-1)/9
      expect(result.reasoning).toBe('Strong content with good clarity');
      expect(result.details).toBeDefined();
      expect(result.details.steps).toHaveLength(3);
    });

    it('should handle evaluation errors gracefully', async () => {
      generateObject.mockRejectedValueOnce(new Error('API error'));

      await expect(
        service.evaluateWithGEval(mockTestCase, { content: 'test' }, 'quality', mockConfig),
      ).rejects.toThrow('API error');
    });
  });

  describe('parseGEvalRubric', () => {
    it('should return default rubric steps', async () => {
      const steps = await service.parseGEvalRubric('/path/to/rubric');

      expect(steps).toBeInstanceOf(Array);
      expect(steps.length).toBeGreaterThan(0);
      expect(steps[0]).toContain('Check if the output addresses');
    });
  });

  describe('normalizeGEvalScore', () => {
    it('should normalize scores correctly', () => {
      const normalized = service.normalizeGEvalScore(7, 'quality', [1, 10]);
      expect(normalized).toBeCloseTo(0.667, 2); // (7-1)/(10-1)
    });

    it('should handle logarithmic scaling for complexity metrics', () => {
      const normalized = service.normalizeGEvalScore(5, 'code_complexity', [0, 10]);
      // Log scale transformation
      expect(normalized).toBeGreaterThan(0);
      expect(normalized).toBeLessThan(1);
    });

    it('should clamp values to range', () => {
      const normalized1 = service.normalizeGEvalScore(15, 'metric', [1, 10]);
      expect(normalized1).toBe(1);

      const normalized2 = service.normalizeGEvalScore(-5, 'metric', [1, 10]);
      expect(normalized2).toBe(0);
    });
  });

  describe('performConsistencyCheck', () => {
    const mockTestCase: TestCase = {
      id: 'test-1',
      pattern: AgentPattern.SEQUENTIAL_PROCESSING,
      input: { prompt: 'Test' },
    };

    const mockConfig: EvaluationConfig = {
      pattern: AgentPattern.SEQUENTIAL_PROCESSING,
      judgeModel: JudgeModel.GEMINI_2_5_PRO,
      metrics: [
        {
          name: 'quality',
          description: 'Quality metric',
          scoreRange: [1, 10],
        },
      ],
    };

    it('should check evaluation consistency', async () => {
      // Mock consistent scores
      generateObject.mockImplementation(async () => ({
        object: {
          steps: ['Step 1'],
          binaryChecks: [],
        },
      }));
      generateText.mockResolvedValue({ text: '' });

      let scoreIndex = 0;
      const scores = [8, 7.5, 8.2];
      generateObject.mockImplementation(async ({ schema }) => {
        if (schema === undefined) {
          // This is for evaluation steps
          return {
            object: {
              steps: ['Step 1'],
              binaryChecks: [],
            },
          };
        } else {
          // This is for score evaluation
          const score = scores[scoreIndex++ % scores.length];
          return {
            object: {
              score,
              reasoning: 'Test reasoning',
              stepResults: [],
            },
          };
        }
      });

      const result = await service.performConsistencyCheck(
        mockTestCase,
        { content: 'Test output' },
        'quality',
        mockConfig,
        3,
      );

      expect(result.scores).toHaveLength(3);
      expect(result.isConsistent).toBe(true); // Variance should be low
      expect(result.variance).toBeLessThan(1);
    });
  });
});
