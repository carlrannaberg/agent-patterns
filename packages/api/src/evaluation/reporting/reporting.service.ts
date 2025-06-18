import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { QualityBaseline, EvaluationResult, EvaluationBatch } from '../../database/entities';

export interface DashboardSummary {
  period: string;
  totalEvaluations: number;
  averageScore: number;
  successRate: number;
  patternPerformance: Array<{
    patternType: string;
    evaluationCount: number;
    averageScore: number;
    successRate: number;
    trend: 'improving' | 'stable' | 'degrading';
  }>;
  topPerformingMetrics: Array<{
    metric: string;
    averageScore: number;
    improvement: number;
  }>;
  recentFailures: Array<{
    patternType: string;
    testCaseId: string;
    error: string;
    timestamp: Date;
  }>;
  systemHealth: {
    status: 'healthy' | 'warning' | 'critical';
    alerts: number;
    avgResponseTime: number;
  };
}

export interface OptimizationOpportunity {
  patternType: string;
  metric: string;
  currentScore: number;
  potentialImprovement: number;
  recommendations: string[];
  estimatedImpact: 'high' | 'medium' | 'low';
  implementationComplexity: 'high' | 'medium' | 'low';
}

@Injectable()
export class ReportingService {
  private readonly logger = new Logger(ReportingService.name);

  constructor(
    @InjectRepository(QualityBaseline)
    private qualityBaselineRepo: Repository<QualityBaseline>,
    @InjectRepository(EvaluationResult)
    private evaluationResultRepo: Repository<EvaluationResult>,
    @InjectRepository(EvaluationBatch)
    private evaluationBatchRepo: Repository<EvaluationBatch>,
  ) {}

  async getDashboardSummary(period: 'day' | 'week' | 'month'): Promise<DashboardSummary> {
    const periodDays = { day: 1, week: 7, month: 30 };
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays[period]);

    const totalEvals = await this.evaluationResultRepo.count({
      where: {
        createdAt: MoreThan(startDate),
      },
    });

    const avgScoreResult = await this.evaluationResultRepo
      .createQueryBuilder('result')
      .select('AVG(result.overallScore)', 'avgScore')
      .where('result.createdAt > :startDate', { startDate })
      .getRawOne();

    const successCount = await this.evaluationResultRepo.count({
      where: {
        createdAt: MoreThan(startDate),
        success: true,
      },
    });

    const patternPerformance = await this.getPatternPerformance(startDate);
    const topMetrics = await this.getTopPerformingMetrics(startDate);
    const recentFailures = await this.getRecentFailures(5);
    const systemHealth = await this.getSystemHealth();

    return {
      period: `Last ${period}`,
      totalEvaluations: totalEvals,
      averageScore: parseFloat(avgScoreResult?.avgScore || '0'),
      successRate: totalEvals > 0 ? (successCount / totalEvals) * 100 : 0,
      patternPerformance,
      topPerformingMetrics: topMetrics,
      recentFailures,
      systemHealth,
    };
  }

  async getQualityBaselines(filters: {
    patternType?: string;
    metric?: string;
    periodType?: 'daily' | 'weekly' | 'monthly' | 'all_time';
  }): Promise<QualityBaseline[]> {
    const where: any = {};
    if (filters.patternType) where.patternType = filters.patternType;
    if (filters.metric) where.metricName = filters.metric;
    if (filters.periodType) where.periodType = filters.periodType;

    return this.qualityBaselineRepo.find({
      where,
      order: { updatedAt: 'DESC' },
    });
  }

  async comparePatternQuality(): Promise<any> {
    const patterns = await this.evaluationResultRepo
      .createQueryBuilder('result')
      .select('DISTINCT result.patternType', 'patternType')
      .getRawMany();

    const comparisons: any[] = [];

    for (const { patternType } of patterns) {
      const baseline = await this.qualityBaselineRepo.findOne({
        where: {
          patternType,
          metricName: 'overall',
          periodType: 'weekly',
        },
      });

      if (baseline) {
        comparisons.push({
          patternType,
          weeklyAverage: baseline.mean,
          weeklyMedian: baseline.median,
          standardDeviation: baseline.stdDeviation,
          qualityRating: this.getQualityRating(baseline.mean),
          trend: baseline.trendData?.direction || 'stable',
          percentileRanks: {
            p25: baseline.p25,
            p50: baseline.median,
            p75: baseline.p75,
            p90: baseline.p90,
          },
        });
      }
    }

    comparisons.sort((a, b) => b.weeklyAverage - a.weeklyAverage);
    return comparisons;
  }

  async identifyOptimizationOpportunities(
    patternType?: string,
  ): Promise<OptimizationOpportunity[]> {
    const opportunities: OptimizationOpportunity[] = [];

    const query = this.qualityBaselineRepo
      .createQueryBuilder('baseline')
      .where('baseline.periodType = :period', { period: 'weekly' })
      .andWhere('baseline.mean < :threshold', { threshold: 0.8 });

    if (patternType) {
      query.andWhere('baseline.patternType = :patternType', { patternType });
    }

    const underperformingMetrics = await query.getMany();

    for (const baseline of underperformingMetrics) {
      const recommendations = this.generateRecommendations(
        baseline.patternType,
        baseline.metricName,
        baseline.mean,
      );

      opportunities.push({
        patternType: baseline.patternType,
        metric: baseline.metricName,
        currentScore: baseline.mean,
        potentialImprovement: Math.max(0, 0.9 - baseline.mean),
        recommendations,
        estimatedImpact: this.estimateImpact(baseline.mean),
        implementationComplexity: this.estimateComplexity(baseline.metricName),
      });
    }

    opportunities.sort((a, b) => b.potentialImprovement - a.potentialImprovement);
    return opportunities;
  }

  async analyzeTrends(params: {
    patternType?: string;
    metric?: string;
    period: 'week' | 'month' | 'quarter';
  }): Promise<any> {
    const periodDays = { week: 7, month: 30, quarter: 90 };
    const intervals = { week: 'day', month: 'week', quarter: 'week' };

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays[params.period]);

    const query = this.evaluationResultRepo
      .createQueryBuilder('result')
      .leftJoin('result.metrics', 'metric')
      .select([
        `DATE_TRUNC('${intervals[params.period]}', result.created_at) as period`,
        'AVG(metric.score) as avg_score',
        'COUNT(DISTINCT result.id) as eval_count',
      ])
      .where('result.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .groupBy(`DATE_TRUNC('${intervals[params.period]}', result.created_at)`)
      .orderBy('period', 'ASC');

    if (params.patternType) {
      query.andWhere('result.patternType = :patternType', {
        patternType: params.patternType,
      });
    }

    if (params.metric) {
      query.andWhere('metric.name = :metricName', {
        metricName: params.metric,
      });
    }

    const trendData = await query.getRawMany();

    const analysis = {
      period: params.period,
      dataPoints: trendData.map((point) => ({
        period: point.period,
        averageScore: parseFloat(point.avg_score),
        evaluationCount: parseInt(point.eval_count),
      })),
      trend: this.calculateTrendDirection(trendData),
      volatility: this.calculateVolatility(trendData),
      forecast: this.generateSimpleForecast(trendData),
    };

    return analysis;
  }

  private async getPatternPerformance(startDate: Date): Promise<any[]> {
    const results = await this.evaluationResultRepo
      .createQueryBuilder('result')
      .select([
        'result.patternType as patternType',
        'COUNT(result.id) as count',
        'AVG(result.overallScore) as avgScore',
        'SUM(CASE WHEN result.success THEN 1 ELSE 0 END)::float / COUNT(*) as successRate',
      ])
      .where('result.createdAt > :startDate', { startDate })
      .groupBy('result.patternType')
      .getRawMany();

    const performance: any[] = [];

    for (const result of results) {
      const baseline = await this.qualityBaselineRepo.findOne({
        where: {
          patternType: result.patterntype,
          metricName: 'overall',
          periodType: 'weekly',
        },
      });

      performance.push({
        patternType: result.patterntype,
        evaluationCount: parseInt(result.count),
        averageScore: parseFloat(result.avgscore),
        successRate: parseFloat(result.successrate) * 100,
        trend: baseline?.trendData?.direction || 'stable',
      });
    }

    return performance;
  }

  private async getTopPerformingMetrics(startDate: Date): Promise<any[]> {
    const currentMetrics = await this.evaluationResultRepo
      .createQueryBuilder('result')
      .leftJoin('result.metrics', 'metric')
      .select(['metric.name as metricName', 'AVG(metric.score) as avgScore'])
      .where('result.createdAt > :startDate', { startDate })
      .groupBy('metric.name')
      .orderBy('AVG(metric.score)', 'DESC')
      .limit(5)
      .getRawMany();

    const topMetrics: any[] = [];

    for (const metric of currentMetrics) {
      const previousPeriodStart = new Date(startDate);
      previousPeriodStart.setDate(
        previousPeriodStart.getDate() - (new Date().getDate() - startDate.getDate()),
      );

      const previousAvg = await this.evaluationResultRepo
        .createQueryBuilder('result')
        .leftJoin('result.metrics', 'metric')
        .select('AVG(metric.score)', 'avgScore')
        .where('metric.name = :name', { name: metric.metricname })
        .andWhere('result.createdAt BETWEEN :start AND :end', {
          start: previousPeriodStart,
          end: startDate,
        })
        .getRawOne();

      const currentAvg = parseFloat(metric.avgscore);
      const previousAvgScore = parseFloat(previousAvg?.avgScore || metric.avgscore);
      const improvement = ((currentAvg - previousAvgScore) / previousAvgScore) * 100;

      topMetrics.push({
        metric: metric.metricname,
        averageScore: currentAvg,
        improvement,
      });
    }

    return topMetrics;
  }

  private async getRecentFailures(limit: number): Promise<any[]> {
    const failures = await this.evaluationResultRepo.find({
      where: { success: false },
      order: { createdAt: 'DESC' },
      take: limit,
    });

    return failures.map((failure) => ({
      patternType: failure.patternType,
      testCaseId: failure.testCaseId,
      error: failure.error,
      timestamp: failure.createdAt,
    }));
  }

  private async getSystemHealth(): Promise<any> {
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    const recentEvals = await this.evaluationResultRepo.find({
      where: { createdAt: MoreThan(oneHourAgo) },
    });

    const avgResponseTime =
      recentEvals.length > 0
        ? recentEvals.reduce((sum, ev) => sum + ev.executionTimeMs, 0) / recentEvals.length
        : 0;

    const failureRate =
      recentEvals.length > 0
        ? recentEvals.filter((e) => !e.success).length / recentEvals.length
        : 0;

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (failureRate > 0.2 || avgResponseTime > 5000) {
      status = 'critical';
    } else if (failureRate > 0.1 || avgResponseTime > 3000) {
      status = 'warning';
    }

    return {
      status,
      alerts: 0, // This would be populated by the alerting service
      avgResponseTime,
    };
  }

  private getQualityRating(score: number): string {
    if (score >= 0.9) return 'Excellent';
    if (score >= 0.8) return 'Good';
    if (score >= 0.7) return 'Acceptable';
    if (score >= 0.6) return 'Needs Improvement';
    return 'Poor';
  }

  private generateRecommendations(
    patternType: string,
    metric: string,
    currentScore: number,
  ): string[] {
    const recommendations: string[] = [];

    if (metric === 'accuracy' && currentScore < 0.8) {
      recommendations.push('Review and improve prompt engineering');
      recommendations.push('Consider using more specific evaluation criteria');
      recommendations.push('Validate test cases for accuracy');
    }

    if (metric === 'performance' && currentScore < 0.7) {
      recommendations.push('Optimize LLM model selection for speed');
      recommendations.push('Implement caching for repeated operations');
      recommendations.push('Consider parallel processing where applicable');
    }

    if (metric === 'reliability' && currentScore < 0.9) {
      recommendations.push('Add retry logic for transient failures');
      recommendations.push('Implement better error handling');
      recommendations.push('Monitor and address timeout issues');
    }

    return recommendations;
  }

  private estimateImpact(currentScore: number): 'high' | 'medium' | 'low' {
    if (currentScore < 0.5) return 'high';
    if (currentScore < 0.7) return 'medium';
    return 'low';
  }

  private estimateComplexity(metric: string): 'high' | 'medium' | 'low' {
    const complexMetrics = ['coherence', 'reasoning', 'creativity'];
    const mediumMetrics = ['accuracy', 'completeness', 'relevance'];

    if (complexMetrics.includes(metric)) return 'high';
    if (mediumMetrics.includes(metric)) return 'medium';
    return 'low';
  }

  private calculateTrendDirection(data: any[]): 'improving' | 'stable' | 'degrading' {
    if (data.length < 2) return 'stable';

    const scores = data.map((d) => parseFloat(d.avg_score));
    const firstHalf = scores.slice(0, Math.floor(scores.length / 2));
    const secondHalf = scores.slice(Math.floor(scores.length / 2));

    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const change = ((secondAvg - firstAvg) / firstAvg) * 100;

    if (Math.abs(change) < 2) return 'stable';
    return change > 0 ? 'improving' : 'degrading';
  }

  private calculateVolatility(data: any[]): number {
    if (data.length < 2) return 0;

    const scores = data.map((d) => parseFloat(d.avg_score));
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance =
      scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;

    return Math.sqrt(variance);
  }

  private generateSimpleForecast(data: any[]): any {
    if (data.length < 3) {
      return { confidence: 'low', nextPeriodEstimate: null };
    }

    const scores = data.map((d) => parseFloat(d.avg_score));
    const recentScores = scores.slice(-3);
    const trend = (recentScores[2] - recentScores[0]) / 2;
    const nextEstimate = recentScores[2] + trend;

    return {
      confidence: data.length > 5 ? 'medium' : 'low',
      nextPeriodEstimate: Math.max(0, Math.min(1, nextEstimate)),
      trendBased: true,
    };
  }
}
