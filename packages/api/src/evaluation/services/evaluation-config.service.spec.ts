import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EvaluationConfigService } from './evaluation-config.service';
import { AgentPattern } from '../enums/agent-pattern.enum';
import { JudgeModel } from '../enums/judge-model.enum';

describe('EvaluationConfigService', () => {
  let service: EvaluationConfigService;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EvaluationConfigService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<EvaluationConfigService>(EvaluationConfigService);
    configService = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getConfig', () => {
    it('should return default config for pattern', async () => {
      const config = service.getConfig(AgentPattern.SEQUENTIAL_PROCESSING);

      expect(config).toBeDefined();
      expect(config.pattern).toBe(AgentPattern.SEQUENTIAL_PROCESSING);
      expect(config.metrics).toHaveLength(4);
      expect(config.metrics[0].name).toBe('content_quality');
      expect(config.enableBiasmitigaation).toBe(true);
      expect(config.enableReliabilityChecks).toBe(true);
    });

    it('should merge environment variables', async () => {
      configService.get.mockImplementation((key: string) => {
        const envMap: Record<string, any> = {
          EVALUATION_JUDGE_MODEL: JudgeModel.GPT_4O,
          EVALUATION_BATCH_SIZE: 10,
          EVALUATION_TIMEOUT_MS: 60000,
        };
        return envMap[key] as JudgeModel | number | string | undefined;
      });

      const config = service.getConfig(AgentPattern.ROUTING);

      expect(config.judgeModel).toBe(JudgeModel.GPT_4O);
      expect(config.batchSize).toBe(10);
      expect(config.timeoutMs).toBe(60000);
    });

    it('should apply overrides', async () => {
      const overrides = {
        temperature: 0.5,
        maxRetries: 5,
        enableBiasmitigaation: false,
      };

      const config = service.getConfig(AgentPattern.PARALLEL_PROCESSING, overrides);

      expect(config.temperature).toBe(0.5);
      expect(config.maxRetries).toBe(5);
      expect(config.enableBiasmitigaation).toBe(false);
    });

    it('should validate configuration', async () => {
      const invalidOverrides = {
        temperature: 3, // Invalid: > 2
      };

      expect(() =>
        service.getConfig(AgentPattern.ORCHESTRATOR_WORKER, invalidOverrides),
      ).toThrow('Invalid temperature: 3');
    });

    it('should throw error for unknown pattern', async () => {
      expect(() => service.getConfig('unknown-pattern' as AgentPattern)).toThrow(
        'No default configuration for pattern: unknown-pattern',
      );
    });
  });

  describe('pattern-specific configurations', () => {
    it('should have routing pattern optimized for accuracy', async () => {
      const config = service.getConfig(AgentPattern.ROUTING);

      expect(config.temperature).toBe(0.0); // Deterministic
      expect(config.metrics[0].name).toBe('classification_accuracy');
      expect(config.metrics[0].binaryCheck).toBe(true);
      expect(config.metrics[0].weight).toBe(3); // High weight
    });

    it('should have evaluator-optimizer pattern focused on optimization', async () => {
      const config = service.getConfig(AgentPattern.EVALUATOR_OPTIMIZER);

      expect(config.metrics.find((m) => m.name === 'optimization_effectiveness')).toBeDefined();
      expect(config.metrics.find((m) => m.name === 'convergence_rate')).toBeDefined();
      expect(config.metrics.find((m) => m.name === 'final_output_quality')?.weight).toBe(3);
    });

    it('should have multi-step tool usage with high accuracy requirements', async () => {
      const config = service.getConfig(AgentPattern.MULTI_STEP_TOOL_USAGE);

      expect(config.temperature).toBe(0.0); // Deterministic
      expect(config.metrics.find((m) => m.name === 'final_answer_accuracy')?.binaryCheck).toBe(
        true,
      );
      expect(config.metrics.find((m) => m.name === 'final_answer_accuracy')?.weight).toBe(3);
    });
  });

  describe('getPatternMetrics', () => {
    it('should return metrics for a pattern', () => {
      const metrics = service.getPatternMetrics(AgentPattern.SEQUENTIAL_PROCESSING);

      expect(metrics).toHaveLength(4);
      expect(metrics.map((m) => m.name)).toContain('content_quality');
      expect(metrics.map((m) => m.name)).toContain('call_to_action');
      expect(metrics.map((m) => m.name)).toContain('emotional_appeal');
      expect(metrics.map((m) => m.name)).toContain('clarity');
    });

    it('should return empty array for unknown pattern', () => {
      const metrics = service.getPatternMetrics('unknown' as AgentPattern);
      expect(metrics).toEqual([]);
    });
  });

  describe('getSupportedJudgeModels', () => {
    it('should return all judge models', () => {
      const models = service.getSupportedJudgeModels();

      expect(models).toContain(JudgeModel.GEMINI_2_5_PRO);
      expect(models).toContain(JudgeModel.GPT_4O);
      expect(models).toContain(JudgeModel.CLAUDE_3_OPUS);
      expect(models).toContain(JudgeModel.LOCAL_OLLAMA);
    });
  });

  describe('getRecommendedJudgeModel', () => {
    it('should recommend specific models for patterns', () => {
      expect(service.getRecommendedJudgeModel(AgentPattern.MULTI_STEP_TOOL_USAGE)).toBe(
        JudgeModel.GEMINI_2_5_PRO,
      );

      expect(service.getRecommendedJudgeModel(AgentPattern.ROUTING)).toBe(
        JudgeModel.GEMINI_2_5_FLASH,
      );
    });

    it('should return default for patterns without recommendation', () => {
      expect(service.getRecommendedJudgeModel(AgentPattern.PARALLEL_PROCESSING)).toBe(
        JudgeModel.GEMINI_2_5_PRO,
      );
    });
  });

  describe('config validation', () => {
    it('should validate metrics', async () => {
      const invalidOverrides = {
        metrics: [
          {
            name: '', // Invalid: empty name
            description: 'Test',
            scoreRange: [1, 10] as [number, number],
          },
        ],
      };

      expect(() =>
        service.getConfig(AgentPattern.SEQUENTIAL_PROCESSING, invalidOverrides),
      ).toThrow('Metric must have name and description');
    });

    it('should validate score ranges', async () => {
      const invalidOverrides = {
        metrics: [
          {
            name: 'test',
            description: 'Test metric',
            scoreRange: [10, 5] as [number, number], // Invalid: min > max
          },
        ],
      };

      expect(() =>
        service.getConfig(AgentPattern.SEQUENTIAL_PROCESSING, invalidOverrides),
      ).toThrow('Invalid score range');
    });

    it('should validate numeric parameters', async () => {
      const testCases = [
        { maxRetries: 0, error: 'Invalid maxRetries: 0' },
        { timeoutMs: 500, error: 'Invalid timeoutMs: 500' },
        { batchSize: 0, error: 'Invalid batchSize: 0' },
      ];

      for (const testCase of testCases) {
        expect(() =>
          service.getConfig(AgentPattern.SEQUENTIAL_PROCESSING, testCase),
        ).toThrow(testCase.error);
      }
    });
  });
});
