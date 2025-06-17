import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EvaluationConfig, EvaluationMetric } from '../interfaces/evaluation.interface';
import { AgentPattern } from '../enums/agent-pattern.enum';
import { JudgeModel, DEFAULT_JUDGE_MODEL } from '../enums/judge-model.enum';

@Injectable()
export class EvaluationConfigService {
  private readonly logger = new Logger(EvaluationConfigService.name);
  private readonly defaultConfigs: Map<AgentPattern, EvaluationConfig>;

  constructor(private readonly configService: ConfigService) {
    this.defaultConfigs = this.initializeDefaultConfigs();
  }

  getConfig(pattern: AgentPattern, overrides?: Partial<EvaluationConfig>): EvaluationConfig {
    // Get pattern-specific default config
    const defaultConfig = this.defaultConfigs.get(pattern);
    if (!defaultConfig) {
      throw new Error(`No default configuration for pattern: ${pattern}`);
    }

    // Get environment variables
    const envConfig: Partial<EvaluationConfig> = {
      judgeModel: this.configService.get<JudgeModel>('EVALUATION_JUDGE_MODEL', DEFAULT_JUDGE_MODEL),
      rubricPath: this.configService.get<string>('EVALUATION_RUBRIC_PATH'),
      sampleSize: this.configService.get<number>('EVALUATION_SAMPLE_SIZE'),
      batchSize: this.configService.get<number>('EVALUATION_BATCH_SIZE'),
      timeoutMs: this.configService.get<number>('EVALUATION_TIMEOUT_MS'),
      maxRetries: this.configService.get<number>('EVALUATION_RETRY_ATTEMPTS'),
    };

    // Remove undefined values from envConfig
    Object.keys(envConfig).forEach((key) => {
      if (envConfig[key as keyof EvaluationConfig] === undefined) {
        delete envConfig[key as keyof EvaluationConfig];
      }
    });

    // Merge configs: default < env < overrides
    const mergedConfig: EvaluationConfig = {
      ...defaultConfig,
      ...envConfig,
      ...overrides,
    };

    // Validate the final configuration
    this.validateConfig(mergedConfig);

    return mergedConfig;
  }

  private initializeDefaultConfigs(): Map<AgentPattern, EvaluationConfig> {
    const configs = new Map<AgentPattern, EvaluationConfig>();

    // Sequential Processing Pattern
    configs.set(AgentPattern.SEQUENTIAL_PROCESSING, {
      pattern: AgentPattern.SEQUENTIAL_PROCESSING,
      judgeModel: DEFAULT_JUDGE_MODEL,
      metrics: [
        {
          name: 'content_quality',
          description: 'Overall quality and coherence of generated content',
          scoreRange: [1, 10],
          weight: 2,
        },
        {
          name: 'call_to_action',
          description: 'Presence and effectiveness of call-to-action',
          scoreRange: [0, 1],
          binaryCheck: true,
        },
        {
          name: 'emotional_appeal',
          description: 'Emotional engagement and persuasiveness',
          scoreRange: [1, 10],
          weight: 1.5,
        },
        {
          name: 'clarity',
          description: 'Clarity and readability of the message',
          scoreRange: [1, 10],
          weight: 1,
        },
      ],
      temperature: 0.1,
      maxRetries: 3,
      timeoutMs: 30000,
      batchSize: 5,
      enableBiasmitigaation: true,
      enableReliabilityChecks: true,
    });

    // Routing Pattern
    configs.set(AgentPattern.ROUTING, {
      pattern: AgentPattern.ROUTING,
      judgeModel: DEFAULT_JUDGE_MODEL,
      metrics: [
        {
          name: 'classification_accuracy',
          description: 'Accuracy of query classification',
          scoreRange: [0, 1],
          binaryCheck: true,
          weight: 3,
        },
        {
          name: 'routing_appropriateness',
          description: 'Appropriateness of specialist selection',
          scoreRange: [1, 10],
          weight: 2,
        },
        {
          name: 'response_relevance',
          description: 'Relevance of response to query',
          scoreRange: [1, 10],
          weight: 2,
        },
      ],
      temperature: 0.0,
      maxRetries: 2,
      timeoutMs: 20000,
      batchSize: 10,
      enableBiasmitigaation: false,
      enableReliabilityChecks: true,
    });

    // Parallel Processing Pattern
    configs.set(AgentPattern.PARALLEL_PROCESSING, {
      pattern: AgentPattern.PARALLEL_PROCESSING,
      judgeModel: DEFAULT_JUDGE_MODEL,
      metrics: [
        {
          name: 'analysis_completeness',
          description: 'Completeness of parallel analysis coverage',
          scoreRange: [1, 10],
          weight: 2,
        },
        {
          name: 'consistency',
          description: 'Consistency across parallel analyses',
          scoreRange: [1, 10],
          weight: 1.5,
        },
        {
          name: 'aggregation_quality',
          description: 'Quality of result aggregation',
          scoreRange: [1, 10],
          weight: 1.5,
        },
        {
          name: 'performance_benefit',
          description: 'Performance improvement from parallelization',
          scoreRange: [0, 1],
          weight: 1,
        },
      ],
      temperature: 0.1,
      maxRetries: 3,
      timeoutMs: 60000,
      batchSize: 3,
      enableBiasmitigaation: true,
      enableReliabilityChecks: true,
    });

    // Orchestrator-Worker Pattern
    configs.set(AgentPattern.ORCHESTRATOR_WORKER, {
      pattern: AgentPattern.ORCHESTRATOR_WORKER,
      judgeModel: DEFAULT_JUDGE_MODEL,
      metrics: [
        {
          name: 'task_decomposition',
          description: 'Quality of task breakdown and planning',
          scoreRange: [1, 10],
          weight: 2,
        },
        {
          name: 'worker_coordination',
          description: 'Effectiveness of worker coordination',
          scoreRange: [1, 10],
          weight: 1.5,
        },
        {
          name: 'implementation_correctness',
          description: 'Correctness of implemented solution',
          scoreRange: [0, 1],
          binaryCheck: true,
          weight: 3,
        },
        {
          name: 'code_quality',
          description: 'Quality of generated code',
          scoreRange: [1, 10],
          weight: 1.5,
        },
      ],
      temperature: 0.2,
      maxRetries: 3,
      timeoutMs: 90000,
      batchSize: 3,
      enableBiasmitigaation: false,
      enableReliabilityChecks: true,
    });

    // Evaluator-Optimizer Pattern
    configs.set(AgentPattern.EVALUATOR_OPTIMIZER, {
      pattern: AgentPattern.EVALUATOR_OPTIMIZER,
      judgeModel: DEFAULT_JUDGE_MODEL,
      metrics: [
        {
          name: 'optimization_effectiveness',
          description: 'Effectiveness of iterative optimization',
          scoreRange: [1, 10],
          weight: 2,
        },
        {
          name: 'evaluation_accuracy',
          description: 'Accuracy of quality evaluation',
          scoreRange: [1, 10],
          weight: 2,
        },
        {
          name: 'convergence_rate',
          description: 'Rate of quality improvement across iterations',
          scoreRange: [0, 1],
          weight: 1,
        },
        {
          name: 'final_output_quality',
          description: 'Quality of final optimized output',
          scoreRange: [1, 10],
          weight: 3,
        },
      ],
      temperature: 0.1,
      maxRetries: 3,
      timeoutMs: 60000,
      batchSize: 5,
      enableBiasmitigaation: true,
      enableReliabilityChecks: true,
    });

    // Multi-Step Tool Usage Pattern
    configs.set(AgentPattern.MULTI_STEP_TOOL_USAGE, {
      pattern: AgentPattern.MULTI_STEP_TOOL_USAGE,
      judgeModel: DEFAULT_JUDGE_MODEL,
      metrics: [
        {
          name: 'tool_selection_accuracy',
          description: 'Accuracy of tool selection for each step',
          scoreRange: [0, 1],
          weight: 2,
        },
        {
          name: 'step_correctness',
          description: 'Correctness of each step execution',
          scoreRange: [1, 10],
          weight: 2.5,
        },
        {
          name: 'final_answer_accuracy',
          description: 'Accuracy of final computed answer',
          scoreRange: [0, 1],
          binaryCheck: true,
          weight: 3,
        },
        {
          name: 'solution_efficiency',
          description: 'Efficiency of solution approach',
          scoreRange: [1, 10],
          weight: 1,
        },
      ],
      temperature: 0.0,
      maxRetries: 2,
      timeoutMs: 45000,
      batchSize: 5,
      enableBiasmitigaation: false,
      enableReliabilityChecks: true,
    });

    return configs;
  }

  private validateConfig(config: EvaluationConfig): void {
    // Validate judge model
    if (!Object.values(JudgeModel).includes(config.judgeModel)) {
      throw new Error(`Invalid judge model: ${config.judgeModel}`);
    }

    // Validate metrics
    if (!config.metrics || config.metrics.length === 0) {
      throw new Error('At least one evaluation metric must be defined');
    }

    config.metrics.forEach((metric) => {
      if (!metric.name || !metric.description) {
        throw new Error('Metric must have name and description');
      }

      if (
        !metric.scoreRange ||
        metric.scoreRange.length !== 2 ||
        metric.scoreRange[0] >= metric.scoreRange[1]
      ) {
        throw new Error(`Invalid score range for metric ${metric.name}: ${metric.scoreRange.join(',')}`); 
      }

      if (metric.weight !== undefined && metric.weight <= 0) {
        throw new Error(`Invalid weight for metric ${metric.name}: ${metric.weight}`);
      }
    });

    // Validate numeric parameters
    if (config.temperature !== undefined && (config.temperature < 0 || config.temperature > 2)) {
      throw new Error(`Invalid temperature: ${config.temperature}`);
    }

    if (config.maxRetries !== undefined && config.maxRetries < 1) {
      throw new Error(`Invalid maxRetries: ${config.maxRetries}`);
    }

    if (config.timeoutMs !== undefined && config.timeoutMs < 1000) {
      throw new Error(`Invalid timeoutMs: ${config.timeoutMs}`);
    }

    if (config.batchSize !== undefined && config.batchSize < 1) {
      throw new Error(`Invalid batchSize: ${config.batchSize}`);
    }
  }

  getPatternMetrics(pattern: AgentPattern): EvaluationMetric[] {
    const config = this.defaultConfigs.get(pattern);
    return config?.metrics || [];
  }

  getSupportedJudgeModels(): JudgeModel[] {
    return Object.values(JudgeModel);
  }

  getRecommendedJudgeModel(pattern: AgentPattern): JudgeModel {
    // Pattern-specific recommendations
    const recommendations: Partial<Record<AgentPattern, JudgeModel>> = {
      [AgentPattern.MULTI_STEP_TOOL_USAGE]: JudgeModel.GEMINI_2_5_PRO,
      [AgentPattern.ORCHESTRATOR_WORKER]: JudgeModel.GEMINI_2_5_PRO,
      [AgentPattern.ROUTING]: JudgeModel.GEMINI_2_5_FLASH,
    };

    return recommendations[pattern] || DEFAULT_JUDGE_MODEL;
  }
}
