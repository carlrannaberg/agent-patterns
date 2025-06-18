import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EvaluationResult, QualityBaseline, FailurePattern } from '../../database/entities';
import { Cron, CronExpression } from '@nestjs/schedule';

interface AggregationResult {
  patternType: string;
  metric: string;
  period: 'hourly' | 'daily' | 'weekly' | 'monthly';
  startDate: Date;
  endDate: Date;
  statistics: {
    count: number;
    mean: number;
    median: number;
    stdDev: number;
    min: number;
    max: number;
    percentiles: {
      p25: number;
      p50: number;
      p75: number;
      p90: number;
      p95: number;
      p99: number;
    };
  };
  trend: {
    direction: 'improving' | 'stable' | 'degrading';
    changePercent: number;
    slope: number;
  };
}

@Injectable()
export class AggregationService {
  private readonly logger = new Logger(AggregationService.name);

  constructor(
    @InjectRepository(EvaluationResult)
    private evaluationResultRepo: Repository<EvaluationResult>,
    @InjectRepository(QualityBaseline)
    private qualityBaselineRepo: Repository<QualityBaseline>,
    @InjectRepository(FailurePattern)
    private failurePatternRepo: Repository<FailurePattern>,
  ) {}

  async aggregateMetrics(
    patternType: string,
    startDate: Date,
    endDate: Date,
    groupBy: 'hour' | 'day' | 'week' | 'month' = 'day',
  ): Promise<AggregationResult[]> {
    const results = await this.evaluationResultRepo
      .createQueryBuilder('result')
      .leftJoinAndSelect('result.metrics', 'metrics')
      .where('result.patternType = :patternType', { patternType })
      .andWhere('result.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .getMany();

    const aggregations: Map<string, AggregationResult> = new Map();

    for (const result of results) {
      for (const metric of result.metrics) {
        const key = `${patternType}-${metric.name}`;
        if (!aggregations.has(key)) {
          aggregations.set(key, {
            patternType,
            metric: metric.name,
            period: this.getPeriodFromGroupBy(groupBy),
            startDate,
            endDate,
            statistics: this.initializeStatistics(),
            trend: { direction: 'stable', changePercent: 0, slope: 0 },
          });
        }

        const agg = aggregations.get(key);
        if (agg) {
          this.updateStatistics(agg.statistics, metric.score);
        }
      }
    }

    for (const agg of aggregations.values()) {
      this.finalizeStatistics(agg.statistics);
      agg.trend = await this.calculateTrend(agg.patternType, agg.metric, agg.statistics.mean);
    }

    return Array.from(aggregations.values());
  }

  async calculateTimeSeriesMetrics(
    patternType: string,
    metric: string,
    startDate: Date,
    endDate: Date,
    interval: 'hour' | 'day' | 'week' = 'day',
  ): Promise<any[]> {
    const query = this.evaluationResultRepo
      .createQueryBuilder('result')
      .leftJoin('result.metrics', 'metric')
      .select([
        `DATE_TRUNC('${interval}', result.created_at) as period`,
        'AVG(metric.score) as avg_score',
        'MIN(metric.score) as min_score',
        'MAX(metric.score) as max_score',
        'COUNT(metric.score) as count',
        'STDDEV(metric.score) as std_dev',
      ])
      .where('result.patternType = :patternType', { patternType })
      .andWhere('metric.name = :metric', { metric })
      .andWhere('result.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .groupBy(`DATE_TRUNC('${interval}', result.created_at)`)
      .orderBy('period', 'ASC');

    const results = await query.getRawMany();

    return results.map((row) => ({
      period: row.period,
      avgScore: parseFloat(row.avg_score),
      minScore: parseFloat(row.min_score),
      maxScore: parseFloat(row.max_score),
      count: parseInt(row.count),
      stdDev: parseFloat(row.std_dev),
    }));
  }

  @Cron(CronExpression.EVERY_HOUR)
  async updateQualityBaselines(): Promise<void> {
    this.logger.log('Updating quality baselines...');

    const patternTypes = await this.evaluationResultRepo
      .createQueryBuilder('result')
      .select('DISTINCT result.patternType', 'patternType')
      .getRawMany();

    for (const { patternType } of patternTypes) {
      await this.updatePatternBaselines(patternType);
    }
  }

  private async updatePatternBaselines(patternType: string): Promise<void> {
    const periods = [
      { type: 'daily' as const, days: 1 },
      { type: 'weekly' as const, days: 7 },
      { type: 'monthly' as const, days: 30 },
      { type: 'all_time' as const, days: null },
    ];

    for (const period of periods) {
      const startDate = period.days
        ? new Date(Date.now() - period.days * 24 * 60 * 60 * 1000)
        : undefined;

      const metrics = await this.getUniqueMetrics(patternType, startDate);

      for (const metric of metrics) {
        const statistics = await this.calculateMetricStatistics(patternType, metric, startDate);

        if (statistics.count === 0) continue;

        const existing = await this.qualityBaselineRepo.findOne({
          where: {
            patternType,
            metricName: metric,
            periodType: period.type,
          },
        });

        const baseline = existing || this.qualityBaselineRepo.create();

        Object.assign(baseline, {
          patternType,
          metricName: metric,
          periodType: period.type,
          mean: statistics.mean,
          median: statistics.median,
          stdDeviation: statistics.stdDev,
          min: statistics.min,
          max: statistics.max,
          p25: statistics.percentiles.p25,
          p75: statistics.percentiles.p75,
          p90: statistics.percentiles.p90,
          p95: statistics.percentiles.p95,
          p99: statistics.percentiles.p99,
          sampleCount: statistics.count,
          calculatedAt: new Date(),
        });

        if (existing) {
          baseline.trendData = {
            direction: this.determineTrendDirection(existing.mean, statistics.mean),
            changePercent: ((statistics.mean - existing.mean) / existing.mean) * 100,
            previousMean: existing.mean,
          };
        }

        baseline.thresholds = this.calculateThresholds(statistics);

        await this.qualityBaselineRepo.save(baseline);
      }
    }
  }

  async detectAnomalies(
    patternType: string,
    metric: string,
    threshold: number = 2.5,
  ): Promise<EvaluationResult[]> {
    const baseline = await this.qualityBaselineRepo.findOne({
      where: {
        patternType,
        metricName: metric,
        periodType: 'weekly',
      },
    });

    if (!baseline) {
      return [];
    }

    const anomalies = await this.evaluationResultRepo
      .createQueryBuilder('result')
      .leftJoinAndSelect('result.metrics', 'metric')
      .where('result.patternType = :patternType', { patternType })
      .andWhere('metric.name = :metricName', { metricName: metric })
      .andWhere('ABS(metric.score - :mean) > :threshold * :stdDev', {
        mean: baseline.mean,
        threshold,
        stdDev: baseline.stdDeviation,
      })
      .orderBy('result.createdAt', 'DESC')
      .limit(100)
      .getMany();

    return anomalies;
  }

  private async getUniqueMetrics(patternType: string, startDate?: Date): Promise<string[]> {
    const query = this.evaluationResultRepo
      .createQueryBuilder('result')
      .leftJoin('result.metrics', 'metric')
      .select('DISTINCT metric.name', 'name')
      .where('result.patternType = :patternType', { patternType });

    if (startDate) {
      query.andWhere('result.createdAt >= :startDate', { startDate });
    }

    const results = await query.getRawMany();
    return results.map((r) => r.name);
  }

  private async calculateMetricStatistics(
    patternType: string,
    metricName: string,
    startDate?: Date,
  ): Promise<any> {
    const query = this.evaluationResultRepo
      .createQueryBuilder('result')
      .leftJoin('result.metrics', 'metric')
      .select('metric.score', 'score')
      .where('result.patternType = :patternType', { patternType })
      .andWhere('metric.name = :metricName', { metricName });

    if (startDate) {
      query.andWhere('result.createdAt >= :startDate', { startDate });
    }

    const results = await query.getRawMany();
    const scores = results.map((r) => parseFloat(r.score));

    if (scores.length === 0) {
      return { count: 0 };
    }

    scores.sort((a, b) => a - b);

    return {
      count: scores.length,
      mean: this.calculateMean(scores),
      median: this.calculatePercentile(scores, 50),
      stdDev: this.calculateStdDev(scores),
      min: scores[0],
      max: scores[scores.length - 1],
      percentiles: {
        p25: this.calculatePercentile(scores, 25),
        p50: this.calculatePercentile(scores, 50),
        p75: this.calculatePercentile(scores, 75),
        p90: this.calculatePercentile(scores, 90),
        p95: this.calculatePercentile(scores, 95),
        p99: this.calculatePercentile(scores, 99),
      },
    };
  }

  private initializeStatistics(): any {
    return {
      count: 0,
      sum: 0,
      sumOfSquares: 0,
      values: [],
      mean: 0,
      median: 0,
      stdDev: 0,
      min: Infinity,
      max: -Infinity,
      percentiles: {},
    };
  }

  private updateStatistics(stats: any, value: number): void {
    stats.count++;
    stats.sum += value;
    stats.sumOfSquares += value * value;
    stats.values.push(value);
    stats.min = Math.min(stats.min, value);
    stats.max = Math.max(stats.max, value);
  }

  private finalizeStatistics(stats: any): void {
    if (stats.count === 0) return;

    stats.mean = stats.sum / stats.count;
    stats.values.sort((a, b) => a - b);
    stats.median = this.calculatePercentile(stats.values, 50);
    stats.stdDev = Math.sqrt(stats.sumOfSquares / stats.count - stats.mean * stats.mean);

    stats.percentiles = {
      p25: this.calculatePercentile(stats.values, 25),
      p50: stats.median,
      p75: this.calculatePercentile(stats.values, 75),
      p90: this.calculatePercentile(stats.values, 90),
      p95: this.calculatePercentile(stats.values, 95),
      p99: this.calculatePercentile(stats.values, 99),
    };

    delete stats.values;
    delete stats.sum;
    delete stats.sumOfSquares;
  }

  private calculateMean(values: number[]): number {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private calculateStdDev(values: number[]): number {
    const mean = this.calculateMean(values);
    const squaredDiffs = values.map((value) => Math.pow(value - mean, 2));
    const avgSquaredDiff = this.calculateMean(squaredDiffs);
    return Math.sqrt(avgSquaredDiff);
  }

  private calculatePercentile(values: number[], percentile: number): number {
    const index = (percentile / 100) * (values.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index % 1;

    if (lower === upper) {
      return values[lower];
    }

    return values[lower] * (1 - weight) + values[upper] * weight;
  }

  private async calculateTrend(
    patternType: string,
    metric: string,
    currentMean: number,
  ): Promise<any> {
    const previousBaseline = await this.qualityBaselineRepo.findOne({
      where: {
        patternType,
        metricName: metric,
        periodType: 'weekly',
      },
    });

    if (!previousBaseline) {
      return { direction: 'stable', changePercent: 0, slope: 0 };
    }

    const changePercent = ((currentMean - previousBaseline.mean) / previousBaseline.mean) * 100;

    return {
      direction: this.determineTrendDirection(previousBaseline.mean, currentMean),
      changePercent,
      slope: changePercent / 7,
    };
  }

  private determineTrendDirection(
    previous: number,
    current: number,
  ): 'improving' | 'stable' | 'degrading' {
    const changePercent = ((current - previous) / previous) * 100;

    if (Math.abs(changePercent) < 2) {
      return 'stable';
    }

    return current > previous ? 'improving' : 'degrading';
  }

  private calculateThresholds(statistics: any): any {
    return {
      excellent: statistics.percentiles.p90,
      good: statistics.percentiles.p75,
      acceptable: statistics.mean,
      poor: statistics.percentiles.p25,
    };
  }

  private getPeriodFromGroupBy(
    groupBy: 'hour' | 'day' | 'week' | 'month',
  ): 'hourly' | 'daily' | 'weekly' | 'monthly' {
    const mapping = {
      hour: 'hourly' as const,
      day: 'daily' as const,
      week: 'weekly' as const,
      month: 'monthly' as const,
    };
    return mapping[groupBy];
  }
}
