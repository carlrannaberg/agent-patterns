import { Injectable, Logger } from '@nestjs/common';
import { AgentPattern } from '../enums/agent-pattern.enum';
import { GoldDatasetService } from './gold-dataset.service';
import { EvaluationService } from './evaluation.service';
import * as math from 'mathjs';

export interface BiasReport {
  pattern: AgentPattern;
  timestamp: Date;
  biasTypes: {
    length: BiasMetric;
    position: BiasMetric;
    complexity: BiasMetric;
    evaluator: BiasMetric;
    temporal: BiasMetric;
  };
  overallBiasScore: number;
  alerts: BiasAlert[];
  recommendations: string[];
}

export interface BiasMetric {
  score: number; // 0-1, where 0 = no bias, 1 = high bias
  pValue?: number;
  effectSize?: number;
  details: Record<string, any>;
}

export interface BiasAlert {
  type: 'length' | 'position' | 'complexity' | 'evaluator' | 'temporal';
  severity: 'low' | 'medium' | 'high';
  message: string;
  metric: BiasMetric;
}

@Injectable()
export class BiasDetectionService {
  private readonly logger = new Logger(BiasDetectionService.name);
  private readonly alertThresholds = {
    low: 0.3,
    medium: 0.5,
    high: 0.7,
  };

  constructor(
    private readonly goldDatasetService: GoldDatasetService,
    private readonly evaluationService: EvaluationService,
  ) {}

  async detectBias(pattern: AgentPattern): Promise<BiasReport> {
    this.logger.log(`Starting bias detection for pattern: ${pattern}`);

    const samples = await this.goldDatasetService.getPatternSamples(pattern);

    const lengthBias = await this.detectLengthBias(samples, pattern);
    const positionBias = await this.detectPositionBias(samples, pattern);
    const complexityBias = await this.detectComplexityBias(samples, pattern);
    const evaluatorBias = await this.detectEvaluatorBias(samples);
    const temporalBias = await this.detectTemporalBias(samples);

    const biasTypes = {
      length: lengthBias,
      position: positionBias,
      complexity: complexityBias,
      evaluator: evaluatorBias,
      temporal: temporalBias,
    };

    const overallBiasScore = this.calculateOverallBias(biasTypes);
    const alerts = this.generateAlerts(biasTypes);
    const recommendations = this.generateRecommendations(biasTypes, alerts);

    return {
      pattern,
      timestamp: new Date(),
      biasTypes,
      overallBiasScore,
      alerts,
      recommendations,
    };
  }

  private async detectLengthBias(samples: any[], pattern: AgentPattern): Promise<BiasMetric> {
    const scoredSamples = samples.filter((s) => s.humanScores.length > 0);

    if (scoredSamples.length < 10) {
      return {
        score: 0,
        details: { message: 'Insufficient samples for length bias detection' },
      };
    }

    const lengths = scoredSamples.map((s) => s.expectedOutput?.content.length || 0);
    const scores = scoredSamples.map((s) =>
      math.mean(s.humanScores.map((hs: any) => hs.scores.overall)),
    );

    // Calculate correlation between length and score
    const correlation = this.calculatePearsonCorrelation(lengths, scores);
    const pValue = this.calculateCorrelationPValue(correlation, lengths.length);

    // Calculate bins for detailed analysis
    const bins = this.createLengthBins(lengths, scores);
    const binVariance = this.calculateBinVariance(bins);

    const biasScore = Math.abs(correlation) * (1 - pValue) * binVariance;

    return {
      score: Math.min(1, biasScore),
      pValue,
      effectSize: Math.abs(correlation),
      details: {
        correlation,
        sampleCount: scoredSamples.length,
        lengthRange: [Math.min(...lengths), Math.max(...lengths)],
        bins,
      },
    };
  }

  private async detectPositionBias(samples: any[], pattern: AgentPattern): Promise<BiasMetric> {
    // Detect if evaluation scores are influenced by position in evaluation order
    const evaluationsByPosition: Record<number, number[]> = {};

    // Group scores by evaluation position
    samples.forEach((sample, position) => {
      if (sample.humanScores.length > 0) {
        const avgScore = math.mean(sample.humanScores.map((hs: any) => hs.scores.overall));
        if (!evaluationsByPosition[position % 10]) {
          evaluationsByPosition[position % 10] = [];
        }
        evaluationsByPosition[position % 10].push(avgScore as number);
      }
    });

    // Calculate variance across positions
    const positionMeans = Object.values(evaluationsByPosition).map((scores) => math.mean(scores));

    const variance = math.var(positionMeans) as number;
    const maxDiff = Math.max(...positionMeans) - Math.min(...positionMeans);

    const biasScore = Math.min(1, (variance * maxDiff) / 10);

    return {
      score: biasScore,
      effectSize: maxDiff,
      details: {
        positionMeans,
        variance,
        maxDifference: maxDiff,
      },
    };
  }

  private async detectComplexityBias(samples: any[], pattern: AgentPattern): Promise<BiasMetric> {
    const complexityGroups = {
      low: samples.filter((s) => s.complexity === 'low' && s.humanScores.length > 0),
      medium: samples.filter((s) => s.complexity === 'medium' && s.humanScores.length > 0),
      high: samples.filter((s) => s.complexity === 'high' && s.humanScores.length > 0),
    };

    const groupMeans = {
      low: this.calculateGroupMean(complexityGroups.low),
      medium: this.calculateGroupMean(complexityGroups.medium),
      high: this.calculateGroupMean(complexityGroups.high),
    };

    // ANOVA-like test for complexity bias
    const grandMean = math.mean(Object.values(groupMeans));
    const betweenGroupVar =
      Object.values(groupMeans).reduce((sum, mean) => sum + Math.pow(mean - grandMean, 2), 0) / 2;

    const withinGroupVar =
      Object.entries(complexityGroups).reduce((sum, [_, group]) => {
        const groupMean = groupMeans[_ as keyof typeof groupMeans];
        return (
          sum +
          group.reduce((s, sample) => {
            const sampleScore = math.mean(
              sample.humanScores.map((hs: any) => hs.scores.overall),
            ) as number;
            return s + Math.pow(sampleScore - groupMean, 2);
          }, 0)
        );
      }, 0) /
      (samples.length - 3);

    const fStatistic = betweenGroupVar / Math.max(withinGroupVar, 0.01);
    const biasScore = Math.min(1, fStatistic / 10);

    return {
      score: biasScore,
      effectSize: fStatistic,
      details: {
        groupMeans,
        grandMean,
        fStatistic,
        sampleCounts: {
          low: complexityGroups.low.length,
          medium: complexityGroups.medium.length,
          high: complexityGroups.high.length,
        },
      },
    };
  }

  private async detectEvaluatorBias(samples: any[]): Promise<BiasMetric> {
    const evaluatorScores: Record<string, number[]> = {};

    // Collect scores by evaluator
    samples.forEach((sample) => {
      sample.humanScores.forEach((score: any) => {
        if (!evaluatorScores[score.evaluatorId]) {
          evaluatorScores[score.evaluatorId] = [];
        }
        evaluatorScores[score.evaluatorId].push(score.scores.overall);
      });
    });

    const evaluatorMeans = Object.entries(evaluatorScores).reduce(
      (acc, [id, scores]) => ({
        ...acc,
        [id]: math.mean(scores),
      }),
      {},
    );

    const meanScores = Object.values(evaluatorMeans);
    const variance = math.var(meanScores) as number;
    const range = Math.max(...meanScores) - Math.min(...meanScores);

    // Check for outlier evaluators
    const mean = math.mean(meanScores) as number;
    const std = math.std(meanScores) as number;
    const outliers = Object.entries(evaluatorMeans).filter(
      ([_, evalMean]) => Math.abs(evalMean - mean) > 2 * std,
    );

    const biasScore = Math.min(1, (variance * range) / 10 + outliers.length * 0.2);

    return {
      score: biasScore,
      effectSize: range,
      details: {
        evaluatorMeans,
        variance,
        range,
        outliers: outliers.map(([id, mean]) => ({ id, mean, deviation: mean - mean })),
      },
    };
  }

  private async detectTemporalBias(samples: any[]): Promise<BiasMetric> {
    const timedSamples = samples
      .filter((s) => s.humanScores.length > 0)
      .map((s) => ({
        timestamp: new Date(s.createdAt).getTime(),
        score: math.mean(s.humanScores.map((hs: any) => hs.scores.overall)) as number,
      }))
      .sort((a, b) => a.timestamp - b.timestamp);

    if (timedSamples.length < 20) {
      return {
        score: 0,
        details: { message: 'Insufficient temporal data' },
      };
    }

    // Split into time windows
    const windowSize = Math.floor(timedSamples.length / 5);
    const windows = [];

    for (let i = 0; i < timedSamples.length; i += windowSize) {
      const window = timedSamples.slice(i, i + windowSize);
      if (window.length > 0) {
        windows.push(math.mean(window.map((s) => s.score)));
      }
    }

    // Check for temporal drift
    const trend = this.calculateTrend(windows);
    const variance = math.var(windows) as number;

    const biasScore = Math.min(1, Math.abs(trend) + variance / 2);

    return {
      score: biasScore,
      effectSize: Math.abs(trend),
      details: {
        trend,
        windows,
        variance,
        timeRange: {
          start: new Date(timedSamples[0].timestamp),
          end: new Date(timedSamples[timedSamples.length - 1].timestamp),
        },
      },
    };
  }

  private calculatePearsonCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    const sumX = math.sum(x);
    const sumY = math.sum(y);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    return denominator === 0 ? 0 : numerator / denominator;
  }

  private calculateCorrelationPValue(r: number, n: number): number {
    // Simplified p-value calculation for correlation
    const t = r * Math.sqrt((n - 2) / (1 - r * r));
    const df = n - 2;

    // Approximate p-value using t-distribution
    // This is a simplified calculation
    const pValue = 2 * (1 - this.tCDF(Math.abs(t), df));
    return Math.max(0, Math.min(1, pValue));
  }

  private tCDF(t: number, df: number): number {
    // Simplified t-distribution CDF approximation
    const x = df / (df + t * t);
    const a = df / 2;
    const b = 0.5;

    // Beta distribution approximation
    return 0.5 + 0.5 * Math.sign(t) * (1 - this.incompleteBeta(x, a, b));
  }

  private incompleteBeta(x: number, a: number, b: number): number {
    // Very simplified incomplete beta function
    // In practice, use a proper statistical library
    return Math.pow(x, a) * Math.pow(1 - x, b);
  }

  private createLengthBins(lengths: number[], scores: number[]): any[] {
    const bins = [
      { range: [0, 100], scores: [] as number[] },
      { range: [100, 500], scores: [] as number[] },
      { range: [500, 1000], scores: [] as number[] },
      { range: [1000, Infinity], scores: [] as number[] },
    ];

    lengths.forEach((length, i) => {
      const bin = bins.find((b) => length >= b.range[0] && length < b.range[1]);
      if (bin) {
        bin.scores.push(scores[i]);
      }
    });

    return bins.map((bin) => ({
      ...bin,
      mean: bin.scores.length > 0 ? math.mean(bin.scores) : 0,
      count: bin.scores.length,
    }));
  }

  private calculateBinVariance(bins: any[]): number {
    const means = bins.filter((b) => b.count > 0).map((b) => b.mean);
    return means.length > 1 ? (math.var(means) as number) : 0;
  }

  private calculateGroupMean(group: any[]): number {
    if (group.length === 0) return 0;
    const scores = group.map(
      (s) => math.mean(s.humanScores.map((hs: any) => hs.scores.overall)) as number,
    );
    return math.mean(scores);
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;

    const x = Array.from({ length: values.length }, (_, i) => i);
    const correlation = this.calculatePearsonCorrelation(x, values);

    return (correlation * (values[values.length - 1] - values[0])) / values[0];
  }

  private calculateOverallBias(biasTypes: Record<string, BiasMetric>): number {
    const weights = {
      length: 0.25,
      position: 0.2,
      complexity: 0.2,
      evaluator: 0.2,
      temporal: 0.15,
    };

    let weightedSum = 0;
    let totalWeight = 0;

    for (const [type, metric] of Object.entries(biasTypes)) {
      const weight = weights[type as keyof typeof weights] || 0.2;
      weightedSum += metric.score * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  private generateAlerts(biasTypes: Record<string, BiasMetric>): BiasAlert[] {
    const alerts: BiasAlert[] = [];

    for (const [type, metric] of Object.entries(biasTypes)) {
      if (metric.score >= this.alertThresholds.high) {
        alerts.push({
          type: type as any,
          severity: 'high',
          message: this.getAlertMessage(type, 'high', metric),
          metric,
        });
      } else if (metric.score >= this.alertThresholds.medium) {
        alerts.push({
          type: type as any,
          severity: 'medium',
          message: this.getAlertMessage(type, 'medium', metric),
          metric,
        });
      } else if (metric.score >= this.alertThresholds.low) {
        alerts.push({
          type: type as any,
          severity: 'low',
          message: this.getAlertMessage(type, 'low', metric),
          metric,
        });
      }
    }

    return alerts.sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  private getAlertMessage(type: string, severity: string, metric: BiasMetric): string {
    const messages = {
      length: {
        high: `Critical length bias detected: correlation ${metric.effectSize?.toFixed(2)}`,
        medium: `Moderate length bias detected: responses of different lengths receive significantly different scores`,
        low: `Minor length bias detected: some correlation between response length and scores`,
      },
      position: {
        high: `Critical position bias: score variance ${metric.effectSize?.toFixed(2)} across positions`,
        medium: `Moderate position bias: evaluation scores vary by position in queue`,
        low: `Minor position bias detected in evaluation ordering`,
      },
      complexity: {
        high: `Critical complexity bias: F-statistic ${metric.effectSize?.toFixed(2)}`,
        medium: `Moderate complexity bias: significant score differences across complexity levels`,
        low: `Minor complexity bias: slight preference for certain complexity levels`,
      },
      evaluator: {
        high: `Critical evaluator bias: range ${metric.effectSize?.toFixed(2)} with outliers`,
        medium: `Moderate evaluator bias: significant differences between evaluators`,
        low: `Minor evaluator bias: some variation in evaluator scoring patterns`,
      },
      temporal: {
        high: `Critical temporal drift: trend ${metric.effectSize?.toFixed(2)}`,
        medium: `Moderate temporal drift in evaluation scores over time`,
        low: `Minor temporal variations detected in scoring`,
      },
    };

    return messages[type]?.[severity] || `${severity} ${type} bias detected`;
  }

  private generateRecommendations(
    biasTypes: Record<string, BiasMetric>,
    alerts: BiasAlert[],
  ): string[] {
    const recommendations: string[] = [];

    if (biasTypes.length.score > this.alertThresholds.medium) {
      recommendations.push(
        'Implement length normalization in scoring to reduce length bias',
        'Review scoring rubrics to ensure they do not favor specific response lengths',
      );
    }

    if (biasTypes.position.score > this.alertThresholds.medium) {
      recommendations.push(
        'Randomize evaluation order for each evaluator',
        'Implement breaks between evaluation sessions to reduce fatigue effects',
      );
    }

    if (biasTypes.complexity.score > this.alertThresholds.medium) {
      recommendations.push(
        'Ensure balanced representation of complexity levels in training',
        'Consider separate scoring scales for different complexity levels',
      );
    }

    if (biasTypes.evaluator.score > this.alertThresholds.medium) {
      recommendations.push(
        'Provide additional training for outlier evaluators',
        'Implement calibration sessions to align evaluator standards',
        'Consider weighted averaging based on evaluator consistency',
      );
    }

    if (biasTypes.temporal.score > this.alertThresholds.medium) {
      recommendations.push(
        'Schedule regular recalibration sessions',
        'Monitor for concept drift in evaluation criteria',
        'Implement sliding window analysis for temporal patterns',
      );
    }

    if (alerts.filter((a) => a.severity === 'high').length >= 2) {
      recommendations.unshift(
        'URGENT: Multiple high-severity biases detected. Immediate recalibration recommended.',
      );
    }

    return recommendations;
  }
}
