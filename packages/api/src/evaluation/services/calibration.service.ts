import { Injectable, Logger } from '@nestjs/common';
import { AgentPattern } from '../enums/agent-pattern.enum';
import { JudgeModel } from '../enums/judge-model.enum';
import { CalibrationResult, GoldSample } from '../interfaces/gold-dataset.interface';
import { TestCase, EvaluationConfig } from '../interfaces/evaluation.interface';
import { GoldDatasetService } from './gold-dataset.service';
import { LlmJudgeService } from './llm-judge.service';
import { EvaluationConfigService } from './evaluation-config.service';
import * as math from 'mathjs';

@Injectable()
export class CalibrationService {
  private readonly logger = new Logger(CalibrationService.name);
  private calibrationCache = new Map<string, CalibrationResult>();
  private readonly defaultWeights = {
    accuracy: 0.3,
    coherence: 0.2,
    completeness: 0.2,
    relevance: 0.2,
    efficiency: 0.1,
  };

  constructor(
    private readonly goldDatasetService: GoldDatasetService,
    private readonly llmJudgeService: LlmJudgeService,
    private readonly configService: EvaluationConfigService,
  ) {}

  async calibratePattern(
    pattern: AgentPattern,
    options: {
      maxIterations?: number;
      learningRate?: number;
      convergenceThreshold?: number;
    } = {},
  ): Promise<CalibrationResult> {
    const { maxIterations = 100, learningRate = 0.01, convergenceThreshold = 0.001 } = options;

    this.logger.log(`Starting calibration for pattern: ${pattern}`);

    // Get gold samples with human scores
    const samples = await this.goldDatasetService.getPatternSamples(pattern);
    const samplesWithScores = samples.filter((s) => s.humanScores.length >= 2);

    if (samplesWithScores.length < 30) {
      throw new Error(
        `Insufficient samples for calibration. Need at least 30, found ${samplesWithScores.length}`,
      );
    }

    // Calculate average human scores
    const humanScores = samplesWithScores.map((sample) => this.calculateAverageHumanScore(sample));

    // Initialize weights
    let weights: Record<string, number> = { ...this.defaultWeights };
    let bestWeights: Record<string, number> = { ...weights };
    let bestCorrelation = -1;
    let previousCorrelation = -1;

    // Optimization loop
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      // Get LLM scores with current weights
      const llmScores = await this.getLLMScoresWithWeights(samplesWithScores, pattern, weights);

      // Calculate Spearman correlation
      const correlation = this.calculateSpearmanCorrelation(humanScores, llmScores);

      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestWeights = { ...weights };
      }

      // Check convergence
      if (Math.abs(correlation - previousCorrelation) < convergenceThreshold) {
        this.logger.log(`Converged after ${iteration} iterations`);
        break;
      }

      // Update weights using gradient approximation
      weights = this.updateWeights(weights, humanScores, llmScores, learningRate);
      previousCorrelation = correlation;

      if (iteration % 10 === 0) {
        this.logger.log(`Iteration ${iteration}: correlation = ${correlation.toFixed(4)}`);
      }
    }

    // Calculate final metrics
    const finalLLMScores = await this.getLLMScoresWithWeights(
      samplesWithScores,
      pattern,
      bestWeights,
    );
    const krippendorffAlpha = this.calculateKrippendorffAlpha(samplesWithScores);
    const confidenceInterval = this.bootstrapConfidenceInterval(humanScores, finalLLMScores);
    const validationMetrics = this.calculateValidationMetrics(humanScores, finalLLMScores);

    const result: CalibrationResult = {
      timestamp: new Date(),
      pattern,
      weights: bestWeights,
      spearmanCorrelation: bestCorrelation,
      krippendorffAlpha,
      confidenceInterval,
      validationMetrics,
    };

    // Cache the result
    this.calibrationCache.set(pattern, result);

    return result;
  }

  async evaluateWithCalibration(
    pattern: AgentPattern,
    input: string,
    output: string,
    context?: Record<string, any>,
  ): Promise<number> {
    const calibration = await this.getCalibration(pattern);

    // Apply position randomization
    const randomizedInputs = this.randomizePositions([input]);

    // Get evaluation with calibrated weights
    const testCase: TestCase = {
      id: 'calibration-test',
      pattern,
      input: randomizedInputs[0],
      context,
    };

    const config: EvaluationConfig = {
      pattern,
      judgeModel: JudgeModel.GEMINI_2_5_PRO,
      metrics: [
        { name: 'accuracy', description: 'Accuracy', scoreRange: [0, 10] },
        { name: 'coherence', description: 'Coherence', scoreRange: [0, 10] },
        { name: 'completeness', description: 'Completeness', scoreRange: [0, 10] },
        { name: 'relevance', description: 'Relevance', scoreRange: [0, 10] },
        { name: 'efficiency', description: 'Efficiency', scoreRange: [0, 10] },
      ],
    };

    const scores = await this.llmJudgeService.evaluate(testCase, output, config);

    // Calculate overall score from metric scores
    const overallScore = scores.metricScores.reduce((sum, metric) => sum + metric.normalizedScore, 0) / scores.metricScores.length;
    
    // Apply length normalization
    const normalizedScore = this.applyLengthNormalization(overallScore, output);

    // Convert metric scores to simple object for weight application
    const scoreMap: Record<string, number> = {};
    scores.metricScores.forEach(metric => {
      scoreMap[metric.metric] = metric.normalizedScore;
    });
    
    // Apply calibrated weights
    const weightedScore = this.applyWeights(scoreMap, calibration.weights);

    return weightedScore;
  }

  private calculateAverageHumanScore(sample: GoldSample): number {
    const scores = sample.humanScores.map((hs) => hs.scores.overall);
    return math.mean(scores);
  }

  private async getLLMScoresWithWeights(
    samples: GoldSample[],
    pattern: AgentPattern,
    weights: Record<string, number>,
  ): Promise<number[]> {
    const scores: number[] = [];

    for (const sample of samples) {
      const testCase: TestCase = {
        id: sample.id,
        pattern,
        input: sample.input,
        expectedOutput: sample.expectedOutput,
        context: sample.input.context,
      };

      const config: EvaluationConfig = {
        pattern,
        judgeModel: JudgeModel.GEMINI_2_5_PRO,
        metrics: [],
      };

      const evaluation = await this.llmJudgeService.evaluate(
        testCase,
        sample.expectedOutput?.content || '',
        config,
      );

      // Convert metricScores to a simple score map
      const scoreMap: Record<string, number> = {};
      evaluation.metricScores.forEach(metricScore => {
        scoreMap[metricScore.metric] = metricScore.normalizedScore;
      });

      const weightedScore = this.applyWeights(scoreMap, weights);
      scores.push(weightedScore);
    }

    return scores;
  }

  private applyWeights(scores: Record<string, number>, weights: Record<string, number>): number {
    let weightedSum = 0;
    let totalWeight = 0;

    for (const [dimension, weight] of Object.entries(weights)) {
      if (scores[dimension] !== undefined) {
        weightedSum += scores[dimension] * weight;
        totalWeight += weight;
      }
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  private calculateSpearmanCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length) {
      throw new Error('Arrays must have the same length');
    }

    const n = x.length;
    const xRanks = this.rankArray(x);
    const yRanks = this.rankArray(y);

    let sumDiffSquared = 0;
    for (let i = 0; i < n; i++) {
      const diff = xRanks[i] - yRanks[i];
      sumDiffSquared += diff * diff;
    }

    return 1 - (6 * sumDiffSquared) / (n * (n * n - 1));
  }

  private rankArray(arr: number[]): number[] {
    const sorted = [...arr].map((val, idx) => ({ val, idx })).sort((a, b) => a.val - b.val);

    const ranks = new Array(arr.length);
    let currentRank = 1;

    for (let i = 0; i < sorted.length; i++) {
      let j = i;
      let sumRanks = 0;
      let count = 0;

      while (j < sorted.length && sorted[j].val === sorted[i].val) {
        sumRanks += currentRank++;
        count++;
        j++;
      }

      const avgRank = sumRanks / count;
      for (let k = i; k < j; k++) {
        ranks[sorted[k].idx] = avgRank;
      }

      i = j - 1;
    }

    return ranks;
  }

  private updateWeights(
    weights: Record<string, number>,
    humanScores: number[],
    llmScores: number[],
    learningRate: number,
  ): Record<string, number> {
    const newWeights = { ...weights };
    const epsilon = 0.01;

    for (const dimension of Object.keys(weights)) {
      // Approximate gradient using finite differences
      const perturbedWeights = { ...weights };
      perturbedWeights[dimension] += epsilon;

      const currentCorr = this.calculateSpearmanCorrelation(humanScores, llmScores);

      // This is a simplified gradient approximation
      // In practice, we'd need to recalculate LLM scores with perturbed weights
      const gradient = (Math.random() - 0.5) * 0.1; // Placeholder

      newWeights[dimension] += learningRate * gradient;
      newWeights[dimension] = Math.max(0, Math.min(1, newWeights[dimension]));
    }

    // Normalize weights
    const sum = Object.values(newWeights).reduce((a, b) => a + b, 0);
    for (const dimension of Object.keys(newWeights)) {
      newWeights[dimension] /= sum;
    }

    return newWeights;
  }

  private calculateKrippendorffAlpha(samples: GoldSample[]): number {
    // Simplified Krippendorff's alpha calculation
    // Full implementation would require more complex coincidence matrix calculation
    const scores: number[][] = [];

    for (const sample of samples) {
      if (sample.humanScores.length >= 2) {
        scores.push(sample.humanScores.map((hs) => hs.scores.overall));
      }
    }

    if (scores.length === 0) return 0;

    // Calculate observed disagreement
    let observedDisagreement = 0;
    let pairCount = 0;

    for (const sampleScores of scores) {
      for (let i = 0; i < sampleScores.length - 1; i++) {
        for (let j = i + 1; j < sampleScores.length; j++) {
          observedDisagreement += Math.pow(sampleScores[i] - sampleScores[j], 2);
          pairCount++;
        }
      }
    }

    observedDisagreement /= pairCount;

    // Calculate expected disagreement
    const allScores = scores.flat();
    const expectedDisagreement = (math.variance(allScores as unknown as number[]) as unknown as number) * 2;

    return 1 - observedDisagreement / expectedDisagreement;
  }

  private bootstrapConfidenceInterval(
    humanScores: number[],
    llmScores: number[],
    iterations = 1000,
    confidence = 0.95,
  ): { lower: number; upper: number } {
    const correlations: number[] = [];
    const n = humanScores.length;

    for (let i = 0; i < iterations; i++) {
      const indices = Array.from({ length: n }, () => Math.floor(Math.random() * n));
      const sampledHuman = indices.map((idx) => humanScores[idx]);
      const sampledLLM = indices.map((idx) => llmScores[idx]);

      correlations.push(this.calculateSpearmanCorrelation(sampledHuman, sampledLLM));
    }

    correlations.sort((a, b) => a - b);
    const lowerIdx = Math.floor(((1 - confidence) / 2) * iterations);
    const upperIdx = Math.floor(((1 + confidence) / 2) * iterations);

    return {
      lower: correlations[lowerIdx],
      upper: correlations[upperIdx],
    };
  }

  private calculateValidationMetrics(
    humanScores: number[],
    llmScores: number[],
  ): { mse: number; mae: number; bias: number } {
    const n = humanScores.length;
    let mse = 0;
    let mae = 0;
    let bias = 0;

    for (let i = 0; i < n; i++) {
      const error = llmScores[i] - humanScores[i];
      mse += error * error;
      mae += Math.abs(error);
      bias += error;
    }

    return {
      mse: mse / n,
      mae: mae / n,
      bias: bias / n,
    };
  }

  private randomizePositions(inputs: string[]): string[] {
    // Simple position randomization - in practice would be more sophisticated
    return [...inputs].sort(() => Math.random() - 0.5);
  }

  private applyLengthNormalization(score: number, output: string): number {
    const length = output.length;
    const optimalLength = 500; // Configurable
    const lengthPenalty = Math.exp(-Math.pow(Math.log(length / optimalLength), 2) / 2);
    return score * (0.8 + 0.2 * lengthPenalty); // 80% original score + 20% length factor
  }

  private async getCalibration(pattern: AgentPattern): Promise<CalibrationResult> {
    let calibration = this.calibrationCache.get(pattern);

    if (!calibration) {
      // Try to load from disk or use default
      calibration = await this.loadCalibrationFromDisk(pattern);

      if (!calibration) {
        // Use default calibration
        calibration = {
          timestamp: new Date(),
          pattern,
          weights: this.defaultWeights,
          spearmanCorrelation: 0,
          krippendorffAlpha: 0,
          confidenceInterval: { lower: 0, upper: 0 },
          validationMetrics: { mse: 0, mae: 0, bias: 0 },
        };
      }

      this.calibrationCache.set(pattern, calibration);
    }

    return calibration;
  }

  private async loadCalibrationFromDisk(pattern: AgentPattern): Promise<CalibrationResult | undefined> {
    // Implementation would load from persistent storage
    return undefined;
  }
}
