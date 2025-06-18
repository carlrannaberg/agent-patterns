import { Injectable, Logger } from '@nestjs/common';
import { AgentPattern } from '../enums/agent-pattern.enum';
import { GoldSample } from '../interfaces/gold-dataset.interface';
import { GoldDatasetService } from './gold-dataset.service';
import { EvaluationConfigService } from './evaluation-config.service';

@Injectable()
export class HumanScoringService {
  private readonly logger = new Logger(HumanScoringService.name);
  private evaluatorActivity = new Map<string, Date>();

  constructor(
    private readonly goldDatasetService: GoldDatasetService,
    private readonly configService: EvaluationConfigService
  ) {}

  async getUnscoreSamples(
    pattern: AgentPattern,
    evaluatorId: string,
    limit: number
  ): Promise<GoldSample[]> {
    const allSamples = await this.goldDatasetService.getPatternSamples(pattern);
    
    // Filter samples that haven't been scored by this evaluator
    const unscoredSamples = allSamples.filter(sample => 
      !sample.humanScores.some(score => score.evaluatorId === evaluatorId)
    );

    // Prioritize edge cases and ensure complexity distribution
    const edgeCases = unscoredSamples.filter(s => s.edgeCase);
    const regularCases = unscoredSamples.filter(s => !s.edgeCase);

    const result: GoldSample[] = [];
    
    // Include at least 20% edge cases
    const edgeCaseCount = Math.ceil(limit * 0.2);
    result.push(...this.shuffleArray(edgeCases).slice(0, edgeCaseCount));
    
    // Fill the rest with stratified regular cases
    const remainingLimit = limit - result.length;
    const stratified = this.stratifySamplesByComplexity(regularCases, remainingLimit);
    result.push(...stratified);

    // Update evaluator activity
    this.evaluatorActivity.set(evaluatorId, new Date());

    return result.slice(0, limit);
  }

  async getEvaluatorProgress(evaluatorId: string): Promise<{
    totalScored: number;
    byPattern: Record<AgentPattern, number>;
    averageTimePerSample: number;
    lastActivity: Date | null;
  }> {
    const patterns = Object.values(AgentPattern);
    const byPattern: Record<string, number> = {};
    let totalScored = 0;
    let totalTime = 0;

    for (const pattern of patterns) {
      const samples = await this.goldDatasetService.getPatternSamples(pattern as AgentPattern);
      let patternCount = 0;

      for (const sample of samples) {
        const evaluatorScores = sample.humanScores.filter(
          score => score.evaluatorId === evaluatorId
        );
        
        if (evaluatorScores.length > 0) {
          patternCount++;
          totalScored++;
          totalTime += evaluatorScores.reduce((sum, score) => sum + score.timeSpent, 0);
        }
      }

      byPattern[pattern] = patternCount;
    }

    return {
      totalScored,
      byPattern: byPattern as Record<AgentPattern, number>,
      averageTimePerSample: totalScored > 0 ? totalTime / totalScored : 0,
      lastActivity: this.evaluatorActivity.get(evaluatorId) || null,
    };
  }

  async calculateAgreementStatistics(pattern: AgentPattern): Promise<{
    krippendorffAlpha: number;
    pairwiseAgreements: Record<string, number>;
    sampleCount: number;
  }> {
    const samples = await this.goldDatasetService.getPatternSamples(pattern);
    const scoredSamples = samples.filter(s => s.humanScores.length >= 2);

    // Calculate Krippendorff's alpha
    const alpha = this.calculateKrippendorffAlpha(scoredSamples);

    // Calculate pairwise agreements
    const evaluatorPairs = this.getEvaluatorPairs(scoredSamples);
    const pairwiseAgreements: Record<string, number> = {};

    for (const [pair, samples] of evaluatorPairs.entries()) {
      pairwiseAgreements[pair] = this.calculatePairwiseAgreement(samples);
    }

    return {
      krippendorffAlpha: alpha,
      pairwiseAgreements,
      sampleCount: scoredSamples.length,
    };
  }

  async getScoringRubric(pattern: AgentPattern): Promise<{
    dimensions: Array<{
      name: string;
      description: string;
      weight: number;
      scale: Array<{
        score: number;
        description: string;
      }>;
    }>;
  }> {
    const rubrics = {
      [AgentPattern.SEQUENTIAL_PROCESSING]: {
        dimensions: [
          {
            name: 'accuracy',
            description: 'Correctness and precision of the generated content',
            weight: 0.3,
            scale: this.getStandardScale('accuracy'),
          },
          {
            name: 'coherence',
            description: 'Logical flow and consistency of the output',
            weight: 0.25,
            scale: this.getStandardScale('coherence'),
          },
          {
            name: 'completeness',
            description: 'Coverage of all required elements',
            weight: 0.25,
            scale: this.getStandardScale('completeness'),
          },
          {
            name: 'relevance',
            description: 'Alignment with the input requirements',
            weight: 0.2,
            scale: this.getStandardScale('relevance'),
          },
        ],
      },
      [AgentPattern.ROUTING]: {
        dimensions: [
          {
            name: 'classification_accuracy',
            description: 'Correctness of query classification',
            weight: 0.4,
            scale: this.getStandardScale('classification'),
          },
          {
            name: 'response_quality',
            description: 'Quality of the specialized response',
            weight: 0.3,
            scale: this.getStandardScale('quality'),
          },
          {
            name: 'efficiency',
            description: 'Speed and resource usage of routing',
            weight: 0.3,
            scale: this.getStandardScale('efficiency'),
          },
        ],
      },
      [AgentPattern.PARALLEL_PROCESSING]: {
        dimensions: [
          {
            name: 'coverage',
            description: 'Completeness of parallel analysis',
            weight: 0.3,
            scale: this.getStandardScale('coverage'),
          },
          {
            name: 'accuracy',
            description: 'Correctness of individual analyses',
            weight: 0.3,
            scale: this.getStandardScale('accuracy'),
          },
          {
            name: 'integration',
            description: 'Quality of combined results',
            weight: 0.2,
            scale: this.getStandardScale('integration'),
          },
          {
            name: 'efficiency',
            description: 'Parallel processing effectiveness',
            weight: 0.2,
            scale: this.getStandardScale('efficiency'),
          },
        ],
      },
      [AgentPattern.ORCHESTRATOR_WORKER]: {
        dimensions: [
          {
            name: 'planning_quality',
            description: 'Quality of task decomposition',
            weight: 0.3,
            scale: this.getStandardScale('planning'),
          },
          {
            name: 'coordination',
            description: 'Effectiveness of worker coordination',
            weight: 0.3,
            scale: this.getStandardScale('coordination'),
          },
          {
            name: 'result_quality',
            description: 'Quality of final integrated output',
            weight: 0.25,
            scale: this.getStandardScale('quality'),
          },
          {
            name: 'adaptability',
            description: 'Handling of edge cases and errors',
            weight: 0.15,
            scale: this.getStandardScale('adaptability'),
          },
        ],
      },
      [AgentPattern.EVALUATOR_OPTIMIZER]: {
        dimensions: [
          {
            name: 'evaluation_accuracy',
            description: 'Correctness of quality assessment',
            weight: 0.35,
            scale: this.getStandardScale('evaluation'),
          },
          {
            name: 'optimization_effectiveness',
            description: 'Quality of iterative improvements',
            weight: 0.35,
            scale: this.getStandardScale('optimization'),
          },
          {
            name: 'convergence',
            description: 'Speed and stability of convergence',
            weight: 0.3,
            scale: this.getStandardScale('convergence'),
          },
        ],
      },
      [AgentPattern.MULTI_STEP_TOOL_USAGE]: {
        dimensions: [
          {
            name: 'tool_selection',
            description: 'Appropriateness of tool choices',
            weight: 0.3,
            scale: this.getStandardScale('tool_selection'),
          },
          {
            name: 'step_accuracy',
            description: 'Correctness of individual steps',
            weight: 0.3,
            scale: this.getStandardScale('accuracy'),
          },
          {
            name: 'final_accuracy',
            description: 'Correctness of final result',
            weight: 0.25,
            scale: this.getStandardScale('final_accuracy'),
          },
          {
            name: 'efficiency',
            description: 'Optimal use of tool calls',
            weight: 0.15,
            scale: this.getStandardScale('efficiency'),
          },
        ],
      },
    };

    return rubrics[pattern] || rubrics[AgentPattern.SEQUENTIAL_PROCESSING];
  }

  private stratifySamplesByComplexity(
    samples: GoldSample[],
    limit: number
  ): GoldSample[] {
    const grouped = {
      low: samples.filter(s => s.complexity === 'low'),
      medium: samples.filter(s => s.complexity === 'medium'),
      high: samples.filter(s => s.complexity === 'high'),
    };

    const perGroup = Math.floor(limit / 3);
    const remainder = limit % 3;

    const result: GoldSample[] = [];
    result.push(...this.shuffleArray(grouped.low).slice(0, perGroup));
    result.push(...this.shuffleArray(grouped.medium).slice(0, perGroup + (remainder > 0 ? 1 : 0)));
    result.push(...this.shuffleArray(grouped.high).slice(0, perGroup + (remainder > 1 ? 1 : 0)));

    return this.shuffleArray(result);
  }

  private shuffleArray<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  private calculateKrippendorffAlpha(samples: GoldSample[]): number {
    // Implementation of Krippendorff's alpha for ordinal data
    const units: number[][] = [];
    
    for (const sample of samples) {
      if (sample.humanScores.length >= 2) {
        units.push(sample.humanScores.map(hs => hs.scores.overall));
      }
    }

    if (units.length === 0) return 0;

    // Create coincidence matrix
    const coincidences: Record<string, number> = {};
    let totalPairs = 0;

    for (const unit of units) {
      for (let i = 0; i < unit.length - 1; i++) {
        for (let j = i + 1; j < unit.length; j++) {
          const key = `${Math.min(unit[i], unit[j])},${Math.max(unit[i], unit[j])}`;
          coincidences[key] = (coincidences[key] || 0) + 1;
          totalPairs++;
        }
      }
    }

    // Calculate observed disagreement
    let observedDisagreement = 0;
    for (const [key, count] of Object.entries(coincidences)) {
      const [v1, v2] = key.split(',').map(Number);
      observedDisagreement += count * Math.pow(v1 - v2, 2);
    }
    observedDisagreement /= totalPairs;

    // Calculate expected disagreement
    const allValues = units.flat();
    const valueCounts: Record<number, number> = {};
    for (const value of allValues) {
      valueCounts[value] = (valueCounts[value] || 0) + 1;
    }

    let expectedDisagreement = 0;
    const n = allValues.length;
    for (const [v1, c1] of Object.entries(valueCounts)) {
      for (const [v2, c2] of Object.entries(valueCounts)) {
        if (v1 !== v2) {
          expectedDisagreement += (c1 * c2 * Math.pow(Number(v1) - Number(v2), 2)) / (n * (n - 1));
        }
      }
    }

    return 1 - (observedDisagreement / expectedDisagreement);
  }

  private getEvaluatorPairs(samples: GoldSample[]): Map<string, GoldSample[]> {
    const pairs = new Map<string, GoldSample[]>();

    for (const sample of samples) {
      const evaluators = [...new Set(sample.humanScores.map(s => s.evaluatorId))].sort();
      
      for (let i = 0; i < evaluators.length - 1; i++) {
        for (let j = i + 1; j < evaluators.length; j++) {
          const pairKey = `${evaluators[i]}-${evaluators[j]}`;
          
          if (!pairs.has(pairKey)) {
            pairs.set(pairKey, []);
          }
          
          pairs.get(pairKey)!.push(sample);
        }
      }
    }

    return pairs;
  }

  private calculatePairwiseAgreement(samples: GoldSample[]): number {
    let totalAgreement = 0;
    let count = 0;

    for (const sample of samples) {
      if (sample.humanScores.length >= 2) {
        const scores = sample.humanScores.map(hs => hs.scores.overall);
        const diff = Math.abs(scores[0] - scores[1]);
        const agreement = 1 - (diff / 10); // Assuming 0-10 scale
        totalAgreement += Math.max(0, agreement);
        count++;
      }
    }

    return count > 0 ? totalAgreement / count : 0;
  }

  private getStandardScale(dimension: string): Array<{ score: number; description: string }> {
    const scales = {
      accuracy: [
        { score: 10, description: 'Perfect accuracy, no errors' },
        { score: 8, description: 'High accuracy, minor errors' },
        { score: 6, description: 'Good accuracy, some notable errors' },
        { score: 4, description: 'Fair accuracy, significant errors' },
        { score: 2, description: 'Poor accuracy, major errors' },
        { score: 0, description: 'Completely inaccurate' },
      ],
      coherence: [
        { score: 10, description: 'Perfect logical flow and consistency' },
        { score: 8, description: 'Strong coherence with minor issues' },
        { score: 6, description: 'Generally coherent with some gaps' },
        { score: 4, description: 'Partially coherent, noticeable issues' },
        { score: 2, description: 'Poor coherence, difficult to follow' },
        { score: 0, description: 'Incoherent or contradictory' },
      ],
      completeness: [
        { score: 10, description: 'All requirements fully addressed' },
        { score: 8, description: 'Most requirements well addressed' },
        { score: 6, description: 'Key requirements addressed' },
        { score: 4, description: 'Some requirements missing' },
        { score: 2, description: 'Many requirements missing' },
        { score: 0, description: 'Requirements not addressed' },
      ],
      default: [
        { score: 10, description: 'Excellent performance' },
        { score: 8, description: 'Good performance' },
        { score: 6, description: 'Satisfactory performance' },
        { score: 4, description: 'Below average performance' },
        { score: 2, description: 'Poor performance' },
        { score: 0, description: 'Unacceptable performance' },
      ],
    };

    return scales[dimension] || scales.default;
  }
}