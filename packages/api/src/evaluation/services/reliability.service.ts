import { Injectable, Logger } from '@nestjs/common';
import {
  EvaluationResult,
  ReliabilityMetrics,
  MetricScore,
} from '../interfaces/evaluation.interface';

@Injectable()
export class ReliabilityService {
  private readonly logger = new Logger(ReliabilityService.name);

  async calculateReliability(results: EvaluationResult[]): Promise<ReliabilityMetrics> {
    if (results.length < 2) {
      throw new Error('At least 2 evaluation results required for reliability calculation');
    }

    this.logger.log(`Calculating reliability metrics for ${results.length} results`);

    // Group results by test case and metric
    const groupedScores = this.groupScoresByTestCaseAndMetric(results);

    // Calculate Krippendorff's alpha for each metric
    const alphaByMetric = new Map<string, number>();
    const allMetrics = this.extractAllMetrics(results);

    for (const metric of allMetrics) {
      const alpha = this.calculateKrippendorffsAlpha(groupedScores, metric);
      alphaByMetric.set(metric, alpha);
    }

    // Calculate overall alpha (average across metrics)
    const alphaValues = Array.from(alphaByMetric.values());
    const overallAlpha = alphaValues.reduce((sum, alpha) => sum + alpha, 0) / alphaValues.length;

    // Calculate inter-rater agreement
    const interRaterAgreement = this.calculateInterRaterAgreement(groupedScores);

    // Bootstrap confidence intervals
    const confidenceInterval = await this.bootstrapConfidenceInterval(results, overallAlpha);

    const metrics: ReliabilityMetrics = {
      krippendorffsAlpha: overallAlpha,
      interRaterAgreement,
      confidenceInterval,
      sampleSize: results.length,
    };

    this.logger.log(
      `Reliability metrics calculated: α=${overallAlpha.toFixed(
        3,
      )}, IRA=${interRaterAgreement.toFixed(3)}`,
    );

    return metrics;
  }

  private groupScoresByTestCaseAndMetric(
    results: EvaluationResult[],
  ): Map<string, Map<string, number[]>> {
    const grouped = new Map<string, Map<string, number[]>>();

    results.forEach((result) => {
      if (!grouped.has(result.testCaseId)) {
        grouped.set(result.testCaseId, new Map());
      }

      const testCaseScores = grouped.get(result.testCaseId)!;

      result.metricScores.forEach((score) => {
        if (!testCaseScores.has(score.metric)) {
          testCaseScores.set(score.metric, []);
        }
        testCaseScores.get(score.metric)!.push(score.normalizedScore);
      });
    });

    return grouped;
  }

  private extractAllMetrics(results: EvaluationResult[]): Set<string> {
    const metrics = new Set<string>();
    results.forEach((result) => {
      result.metricScores.forEach((score) => {
        metrics.add(score.metric);
      });
    });
    return metrics;
  }

  private calculateKrippendorffsAlpha(
    groupedScores: Map<string, Map<string, number[]>>,
    metric: string,
  ): number {
    // Extract rating matrix for the metric
    const ratingMatrix: number[][] = [];

    groupedScores.forEach((testCaseScores) => {
      const scores = testCaseScores.get(metric);
      if (scores && scores.length > 1) {
        ratingMatrix.push(scores);
      }
    });

    if (ratingMatrix.length === 0) {
      return 0;
    }

    // Calculate observed disagreement
    const observedDisagreement = this.calculateObservedDisagreement(ratingMatrix);

    // Calculate expected disagreement
    const expectedDisagreement = this.calculateExpectedDisagreement(ratingMatrix);

    // Krippendorff's alpha = 1 - (observed / expected)
    if (expectedDisagreement === 0) {
      return 1; // Perfect agreement
    }

    const alpha = 1 - observedDisagreement / expectedDisagreement;
    return Math.max(0, Math.min(1, alpha)); // Clamp to [0, 1]
  }

  private calculateObservedDisagreement(ratingMatrix: number[][]): number {
    let totalDisagreement = 0;
    let totalPairs = 0;

    ratingMatrix.forEach((ratings) => {
      for (let i = 0; i < ratings.length - 1; i++) {
        for (let j = i + 1; j < ratings.length; j++) {
          totalDisagreement += Math.pow(ratings[i] - ratings[j], 2);
          totalPairs++;
        }
      }
    });

    return totalPairs > 0 ? totalDisagreement / totalPairs : 0;
  }

  private calculateExpectedDisagreement(ratingMatrix: number[][]): number {
    // Flatten all ratings
    const allRatings = ratingMatrix.flat();
    const n = allRatings.length;

    if (n < 2) return 0;

    // Calculate mean and variance
    const mean = allRatings.reduce((sum, r) => sum + r, 0) / n;
    const variance = allRatings.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (n - 1);

    return 2 * variance;
  }

  private calculateInterRaterAgreement(groupedScores: Map<string, Map<string, number[]>>): number {
    let totalAgreement = 0;
    let totalComparisons = 0;

    groupedScores.forEach((testCaseScores) => {
      testCaseScores.forEach((scores) => {
        if (scores.length < 2) return;

        // Calculate pairwise agreement
        for (let i = 0; i < scores.length - 1; i++) {
          for (let j = i + 1; j < scores.length; j++) {
            const difference = Math.abs(scores[i] - scores[j]);
            // Consider agreement if difference is less than 0.1 (10% on normalized scale)
            if (difference < 0.1) {
              totalAgreement++;
            }
            totalComparisons++;
          }
        }
      });
    });

    return totalComparisons > 0 ? totalAgreement / totalComparisons : 0;
  }

  private async bootstrapConfidenceInterval(
    results: EvaluationResult[],
    observedAlpha: number,
    numBootstraps: number = 1000,
    confidenceLevel: number = 0.95,
  ): Promise<[number, number]> {
    const bootstrapAlphas: number[] = [];

    for (let i = 0; i < numBootstraps; i++) {
      // Resample with replacement
      const resampledResults = this.resampleWithReplacement(results);

      // Calculate alpha for resampled data
      const groupedScores = this.groupScoresByTestCaseAndMetric(resampledResults);
      const metrics = this.extractAllMetrics(resampledResults);

      let sumAlpha = 0;
      metrics.forEach((metric) => {
        sumAlpha += this.calculateKrippendorffsAlpha(groupedScores, metric);
      });

      bootstrapAlphas.push(sumAlpha / metrics.size);
    }

    // Sort bootstrap alphas
    bootstrapAlphas.sort((a, b) => a - b);

    // Calculate confidence interval
    const lowerIndex = Math.floor(((1 - confidenceLevel) / 2) * numBootstraps);
    const upperIndex = Math.floor(((1 + confidenceLevel) / 2) * numBootstraps);

    return [bootstrapAlphas[lowerIndex] || 0, bootstrapAlphas[upperIndex] || 1];
  }

  private resampleWithReplacement(results: EvaluationResult[]): EvaluationResult[] {
    const resampled: EvaluationResult[] = [];
    const n = results.length;

    for (let i = 0; i < n; i++) {
      const randomIndex = Math.floor(Math.random() * n);
      resampled.push(results[randomIndex]);
    }

    return resampled;
  }

  async validateEvaluationConsistency(
    results: EvaluationResult[],
    threshold: number = 0.7,
  ): Promise<{
    isConsistent: boolean;
    metrics: ReliabilityMetrics;
    recommendations: string[];
  }> {
    const metrics = await this.calculateReliability(results);
    const isConsistent = (metrics.krippendorffsAlpha || 0) >= threshold;

    const recommendations: string[] = [];

    if (!isConsistent) {
      if ((metrics.krippendorffsAlpha || 0) < 0.4) {
        recommendations.push(
          'Low reliability detected. Consider:',
          '- Using a more deterministic judge model (lower temperature)',
          '- Providing clearer evaluation criteria',
          '- Adding more specific rubric steps',
        );
      } else if ((metrics.krippendorffsAlpha || 0) < 0.7) {
        recommendations.push(
          'Moderate reliability. Consider:',
          '- Fine-tuning evaluation prompts',
          '- Adding binary checks for critical criteria',
          '- Increasing sample size for more stable estimates',
        );
      }
    }

    if ((metrics.interRaterAgreement || 0) < 0.8) {
      recommendations.push(
        'Low inter-rater agreement. Consider:',
        '- Standardizing score ranges across metrics',
        '- Using G-Eval methodology for more consistent scoring',
      );
    }

    return {
      isConsistent,
      metrics,
      recommendations,
    };
  }

  calculateCohenKappa(
    rater1Scores: number[],
    rater2Scores: number[],
    categories: number[] = [0, 0.25, 0.5, 0.75, 1.0],
  ): number {
    if (rater1Scores.length !== rater2Scores.length) {
      throw new Error('Rater scores must have the same length');
    }

    const n = rater1Scores.length;

    // Discretize continuous scores into categories
    const categorize = (score: number): number => {
      for (let i = categories.length - 1; i >= 0; i--) {
        if (score >= categories[i]) return i;
      }
      return 0;
    };

    const rater1Categories = rater1Scores.map(categorize);
    const rater2Categories = rater2Scores.map(categorize);

    // Calculate observed agreement
    let observedAgreement = 0;
    for (let i = 0; i < n; i++) {
      if (rater1Categories[i] === rater2Categories[i]) {
        observedAgreement++;
      }
    }
    const po = observedAgreement / n;

    // Calculate expected agreement
    const rater1Counts = new Array(categories.length).fill(0);
    const rater2Counts = new Array(categories.length).fill(0);

    rater1Categories.forEach((cat) => rater1Counts[cat]++);
    rater2Categories.forEach((cat) => rater2Counts[cat]++);

    let expectedAgreement = 0;
    for (let i = 0; i < categories.length; i++) {
      expectedAgreement += (rater1Counts[i] / n) * (rater2Counts[i] / n);
    }

    // Cohen's Kappa = (po - pe) / (1 - pe)
    if (expectedAgreement === 1) return 1;

    return (po - expectedAgreement) / (1 - expectedAgreement);
  }
}
