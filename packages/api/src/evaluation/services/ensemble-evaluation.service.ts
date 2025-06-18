import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { AgentPattern } from '../enums/agent-pattern.enum';
import { JudgeModel } from '../enums/judge-model.enum';
import { EvaluationConfigService } from './evaluation-config.service';
import { LlmJudgeService } from './llm-judge.service';

interface EnsembleConfig {
  models: JudgeModel[];
  weights?: Record<JudgeModel, number>;
  strategy: 'average' | 'weighted' | 'consensus' | 'max';
  disagreementThreshold?: number;
}

interface EnsembleResult {
  finalScore: number;
  modelScores: Record<JudgeModel, number>;
  consensus: number;
  confidence: number;
  disagreementAlerts: string[];
}

@Injectable()
export class EnsembleEvaluationService {
  private readonly logger = new Logger(EnsembleEvaluationService.name);
  private readonly genAI: GoogleGenerativeAI;
  private modelCache = new Map<JudgeModel, GenerativeModel>();

  constructor(
    private readonly configService: EvaluationConfigService,
    private readonly llmJudgeService: LlmJudgeService
  ) {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is required');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async evaluateWithEnsemble(
    pattern: AgentPattern,
    input: string,
    output: string,
    context?: Record<string, any>,
    config?: EnsembleConfig
  ): Promise<EnsembleResult> {
    const ensembleConfig = config || this.getDefaultConfig(pattern);
    const modelScores: Record<JudgeModel, number> = {} as any;
    const detailedScores: Record<JudgeModel, Record<string, number>> = {} as any;

    // Collect scores from all models
    await Promise.all(
      ensembleConfig.models.map(async (model) => {
        try {
          const scores = await this.evaluateWithModel(
            model,
            pattern,
            input,
            output,
            context
          );
          modelScores[model] = scores.overall;
          detailedScores[model] = scores;
        } catch (error) {
          this.logger.error(`Error evaluating with model ${model}:`, error);
          modelScores[model] = -1; // Mark as failed
        }
      })
    );

    // Filter out failed evaluations
    const validScores = Object.entries(modelScores)
      .filter(([_, score]) => score >= 0)
      .reduce((acc, [model, score]) => ({ ...acc, [model]: score }), {} as Record<JudgeModel, number>);

    // Calculate final score based on strategy
    const finalScore = this.calculateFinalScore(
      validScores,
      ensembleConfig.strategy,
      ensembleConfig.weights
    );

    // Calculate consensus and confidence
    const consensus = this.calculateConsensus(validScores);
    const confidence = this.calculateConfidence(validScores, consensus);

    // Check for disagreements
    const disagreementAlerts = this.checkDisagreements(
      validScores,
      ensembleConfig.disagreementThreshold || 2.0
    );

    return {
      finalScore,
      modelScores,
      consensus,
      confidence,
      disagreementAlerts,
    };
  }

  async evaluateWithRandomizedEnsemble(
    pattern: AgentPattern,
    inputs: string[],
    outputs: string[],
    context?: Record<string, any>
  ): Promise<EnsembleResult[]> {
    // Randomize input-output pairs to reduce position bias
    const pairs = inputs.map((input, i) => ({ input, output: outputs[i], index: i }));
    const shuffled = this.shuffleArray(pairs);

    const results = await Promise.all(
      shuffled.map(pair => 
        this.evaluateWithEnsemble(pattern, pair.input, pair.output, context)
      )
    );

    // Restore original order
    const orderedResults = new Array(results.length);
    shuffled.forEach((pair, i) => {
      orderedResults[pair.index] = results[i];
    });

    return orderedResults;
  }

  private async evaluateWithModel(
    modelName: JudgeModel,
    pattern: AgentPattern,
    input: string,
    output: string,
    context?: Record<string, any>
  ): Promise<Record<string, number>> {
    const model = this.getModel(modelName);
    const prompt = this.buildEvaluationPrompt(pattern, input, output, context);

    try {
      const result = await model.generateContent(prompt);
      const response = result.response.text();
      return this.parseScores(response);
    } catch (error) {
      this.logger.error(`Model ${modelName} evaluation failed:`, error);
      throw error;
    }
  }

  private getModel(modelName: JudgeModel): GenerativeModel {
    if (!this.modelCache.has(modelName)) {
      this.modelCache.set(modelName, this.genAI.getGenerativeModel({ model: modelName }));
    }
    return this.modelCache.get(modelName)!;
  }

  private calculateFinalScore(
    scores: Record<JudgeModel, number>,
    strategy: EnsembleConfig['strategy'],
    weights?: Record<JudgeModel, number>
  ): number {
    const scoreValues = Object.values(scores);
    
    switch (strategy) {
      case 'average':
        return scoreValues.reduce((sum, score) => sum + score, 0) / scoreValues.length;
      
      case 'weighted':
        if (!weights) {
          return this.calculateFinalScore(scores, 'average');
        }
        let weightedSum = 0;
        let totalWeight = 0;
        for (const [model, score] of Object.entries(scores)) {
          const weight = weights[model as JudgeModel] || 1;
          weightedSum += score * weight;
          totalWeight += weight;
        }
        return totalWeight > 0 ? weightedSum / totalWeight : 0;
      
      case 'consensus':
        // Use median for consensus
        const sorted = [...scoreValues].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0
          ? (sorted[mid - 1] + sorted[mid]) / 2
          : sorted[mid];
      
      case 'max':
        return Math.max(...scoreValues);
      
      default:
        return this.calculateFinalScore(scores, 'average');
    }
  }

  private calculateConsensus(scores: Record<JudgeModel, number>): number {
    const values = Object.values(scores);
    if (values.length < 2) return 1;

    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    // Consensus score: 1 - normalized standard deviation
    // Lower std dev = higher consensus
    return Math.max(0, 1 - (stdDev / 5)); // Assuming 0-10 scale
  }

  private calculateConfidence(
    scores: Record<JudgeModel, number>,
    consensus: number
  ): number {
    const modelCount = Object.keys(scores).length;
    const totalModels = Object.values(JudgeModel).length;
    
    // Confidence based on model participation and consensus
    const participationRate = modelCount / totalModels;
    return (participationRate * 0.3 + consensus * 0.7);
  }

  private checkDisagreements(
    scores: Record<JudgeModel, number>,
    threshold: number
  ): string[] {
    const alerts: string[] = [];
    const values = Object.entries(scores);

    for (let i = 0; i < values.length - 1; i++) {
      for (let j = i + 1; j < values.length; j++) {
        const [model1, score1] = values[i];
        const [model2, score2] = values[j];
        const diff = Math.abs(score1 - score2);

        if (diff > threshold) {
          alerts.push(
            `High disagreement between ${model1} (${score1.toFixed(1)}) and ${model2} (${score2.toFixed(1)}): ${diff.toFixed(1)} points`
          );
        }
      }
    }

    return alerts;
  }

  private getDefaultConfig(pattern: AgentPattern): EnsembleConfig {
    // Pattern-specific default configurations
    const configs: Record<AgentPattern, EnsembleConfig> = {
      [AgentPattern.SEQUENTIAL_PROCESSING]: {
        models: [JudgeModel.GEMINI_PRO, JudgeModel.GEMINI_FLASH],
        strategy: 'weighted',
        weights: {
          [JudgeModel.GEMINI_PRO]: 0.7,
          [JudgeModel.GEMINI_FLASH]: 0.3,
        },
        disagreementThreshold: 2.0,
      },
      [AgentPattern.ROUTING]: {
        models: [JudgeModel.GEMINI_PRO, JudgeModel.GEMINI_FLASH],
        strategy: 'consensus',
        disagreementThreshold: 1.5,
      },
      [AgentPattern.PARALLEL_PROCESSING]: {
        models: [JudgeModel.GEMINI_PRO, JudgeModel.GEMINI_FLASH],
        strategy: 'average',
        disagreementThreshold: 2.0,
      },
      [AgentPattern.ORCHESTRATOR_WORKER]: {
        models: [JudgeModel.GEMINI_PRO, JudgeModel.GEMINI_FLASH],
        strategy: 'weighted',
        weights: {
          [JudgeModel.GEMINI_PRO]: 0.8,
          [JudgeModel.GEMINI_FLASH]: 0.2,
        },
        disagreementThreshold: 2.5,
      },
      [AgentPattern.EVALUATOR_OPTIMIZER]: {
        models: [JudgeModel.GEMINI_PRO, JudgeModel.GEMINI_FLASH],
        strategy: 'max',
        disagreementThreshold: 3.0,
      },
      [AgentPattern.MULTI_STEP_TOOL_USAGE]: {
        models: [JudgeModel.GEMINI_PRO, JudgeModel.GEMINI_FLASH],
        strategy: 'weighted',
        weights: {
          [JudgeModel.GEMINI_PRO]: 0.6,
          [JudgeModel.GEMINI_FLASH]: 0.4,
        },
        disagreementThreshold: 2.0,
      },
    };

    return configs[pattern];
  }

  private buildEvaluationPrompt(
    pattern: AgentPattern,
    input: string,
    output: string,
    context?: Record<string, any>
  ): string {
    return `
Evaluate the following ${pattern} agent output on multiple dimensions.

Input: ${input}
Output: ${output}
${context ? `Context: ${JSON.stringify(context, null, 2)}` : ''}

Please score each dimension from 0-10 and provide an overall score.
Return your evaluation in the following JSON format:

{
  "overall": <number>,
  "accuracy": <number>,
  "coherence": <number>,
  "completeness": <number>,
  "relevance": <number>,
  "efficiency": <number>
}

Only return the JSON object, no additional text.
`;
  }

  private parseScores(response: string): Record<string, number> {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      
      const scores = JSON.parse(jsonMatch[0]);
      
      // Validate and normalize scores
      const normalized: Record<string, number> = {};
      for (const [key, value] of Object.entries(scores)) {
        if (typeof value === 'number') {
          normalized[key] = Math.max(0, Math.min(10, value));
        }
      }
      
      return normalized;
    } catch (error) {
      this.logger.error('Failed to parse scores:', error);
      throw new Error('Failed to parse evaluation scores');
    }
  }

  private shuffleArray<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}