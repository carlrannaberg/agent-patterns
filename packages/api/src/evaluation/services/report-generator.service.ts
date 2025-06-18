import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';
import {
  EvaluationResult,
  EvaluationBatch,
  QualityBaseline,
  FailurePattern,
} from '../../database/entities';
import { AggregationService } from './aggregation.service';
import { FailureAnalysisService } from './failure-analysis.service';

export interface GenerateReportDto {
  reportType: 'summary' | 'detailed' | 'comparison' | 'trend' | 'failure';
  format: 'pdf' | 'json' | 'csv';
  patternType?: string;
  startDate: string;
  endDate: string;
  metrics?: string[];
  customOptions?: Record<string, any>;
}

interface ReportData {
  title: string;
  generatedAt: Date;
  period: { start: Date; end: Date };
  summary: {
    totalEvaluations: number;
    averageScore: number;
    successRate: number;
    patternBreakdown: Array<{
      pattern: string;
      count: number;
      avgScore: number;
    }>;
  };
  metrics?: Array<{
    name: string;
    statistics: any;
    trend: any;
  }>;
  failures?: Array<{
    pattern: string;
    category: string;
    count: number;
    impact: number;
    status: string;
    rootCause: string;
    suggestedFixes: string[];
  }>;
  recommendations?: string[];
}

@Injectable()
export class ReportGeneratorService {
  private readonly logger = new Logger(ReportGeneratorService.name);

  constructor(
    @InjectRepository(EvaluationResult)
    private evaluationResultRepo: Repository<EvaluationResult>,
    @InjectRepository(EvaluationBatch)
    private evaluationBatchRepo: Repository<EvaluationBatch>,
    @InjectRepository(QualityBaseline)
    private qualityBaselineRepo: Repository<QualityBaseline>,
    @InjectRepository(FailurePattern)
    private failurePatternRepo: Repository<FailurePattern>,
    private aggregationService: AggregationService,
    private failureAnalysisService: FailureAnalysisService,
  ) {}

  async generateReport(dto: GenerateReportDto): Promise<any> {
    const reportData = await this.collectReportData(dto);

    switch (dto.format) {
      case 'pdf':
        return this.generatePdfReport(reportData, dto);
      case 'json':
        return this.generateJsonReport(reportData);
      case 'csv':
        return this.generateCsvReport(reportData, dto);
      default:
        throw new Error(`Unsupported format: ${dto.format}`);
    }
  }

  async getAvailableTemplates(): Promise<any[]> {
    return [
      {
        id: 'summary',
        name: 'Executive Summary',
        description: 'High-level overview of evaluation performance',
        supportedFormats: ['pdf', 'json'],
      },
      {
        id: 'detailed',
        name: 'Detailed Analysis',
        description: 'Comprehensive evaluation results with metrics breakdown',
        supportedFormats: ['pdf', 'json', 'csv'],
      },
      {
        id: 'comparison',
        name: 'Pattern Comparison',
        description: 'Comparative analysis across different patterns',
        supportedFormats: ['pdf', 'json'],
      },
      {
        id: 'trend',
        name: 'Trend Analysis',
        description: 'Time-series analysis of evaluation metrics',
        supportedFormats: ['pdf', 'json', 'csv'],
      },
      {
        id: 'failure',
        name: 'Failure Analysis',
        description: 'Detailed breakdown of failure patterns and root causes',
        supportedFormats: ['pdf', 'json'],
      },
    ];
  }

  private async collectReportData(dto: GenerateReportDto): Promise<ReportData> {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    const baseData = await this.getBaseReportData(startDate, endDate, dto.patternType);

    let reportData: ReportData = {
      title: this.getReportTitle(dto.reportType, dto.patternType),
      generatedAt: new Date(),
      period: { start: startDate, end: endDate },
      summary: baseData,
    };

    switch (dto.reportType) {
      case 'detailed':
        reportData.metrics = await this.getDetailedMetrics(
          startDate,
          endDate,
          dto.patternType,
          dto.metrics,
        );
        break;

      case 'comparison':
        reportData = await this.getComparisonData(startDate, endDate);
        break;

      case 'trend':
        reportData.metrics = await this.getTrendData(
          startDate,
          endDate,
          dto.patternType,
          dto.metrics,
        );
        break;

      case 'failure':
        reportData.failures = await this.getFailureData(startDate, endDate, dto.patternType);
        break;
    }

    reportData.recommendations = await this.generateRecommendations(reportData);

    return reportData;
  }

  private async getBaseReportData(
    startDate: Date,
    endDate: Date,
    patternType?: string,
  ): Promise<any> {
    const where: any = {
      createdAt: Between(startDate, endDate),
    };

    if (patternType) {
      where.patternType = patternType;
    }

    const totalEvaluations = await this.evaluationResultRepo.count({ where });

    const avgScoreResult = await this.evaluationResultRepo
      .createQueryBuilder('result')
      .select('AVG(result.overallScore)', 'avgScore')
      .where('result.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .andWhere(patternType ? 'result.patternType = :patternType' : '1=1', {
        patternType,
      })
      .getRawOne();

    const successCount = await this.evaluationResultRepo.count({
      where: { ...where, success: true },
    });

    const patternBreakdown = await this.evaluationResultRepo
      .createQueryBuilder('result')
      .select([
        'result.patternType as pattern',
        'COUNT(result.id) as count',
        'AVG(result.overallScore) as avgScore',
      ])
      .where('result.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .groupBy('result.patternType')
      .getRawMany();

    return {
      totalEvaluations,
      averageScore: parseFloat(avgScoreResult?.avgScore || '0'),
      successRate: totalEvaluations > 0 ? (successCount / totalEvaluations) * 100 : 0,
      patternBreakdown: patternBreakdown.map((p) => ({
        pattern: p.pattern,
        count: parseInt(p.count),
        avgScore: parseFloat(p.avgScore),
      })),
    };
  }

  private async getDetailedMetrics(
    startDate: Date,
    endDate: Date,
    patternType?: string,
    metrics?: string[],
  ): Promise<any[]> {
    const query = this.evaluationResultRepo
      .createQueryBuilder('result')
      .leftJoin('result.metrics', 'metric')
      .select([
        'metric.name as name',
        'AVG(metric.score) as avgScore',
        'MIN(metric.score) as minScore',
        'MAX(metric.score) as maxScore',
        'STDDEV(metric.score) as stdDev',
        'COUNT(metric.score) as count',
      ])
      .where('result.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .groupBy('metric.name');

    if (patternType) {
      query.andWhere('result.patternType = :patternType', { patternType });
    }

    if (metrics && metrics.length > 0) {
      query.andWhere('metric.name IN (:...metrics)', { metrics });
    }

    const metricStats = await query.getRawMany();

    const detailedMetrics: Array<{
      name: string;
      statistics: any;
      trend: any;
      baseline: any;
    }> = [];

    for (const stat of metricStats) {
      const baseline = await this.qualityBaselineRepo.findOne({
        where: {
          metricName: stat.name,
          periodType: 'weekly',
          ...(patternType && { patternType }),
        },
      });

      detailedMetrics.push({
        name: stat.name,
        statistics: {
          average: parseFloat(stat.avgScore),
          min: parseFloat(stat.minScore),
          max: parseFloat(stat.maxScore),
          stdDev: parseFloat(stat.stdDev),
          count: parseInt(stat.count),
        },
        trend: baseline?.trendData || { direction: 'stable', changePercent: 0 },
        baseline: baseline
          ? {
              weeklyAverage: baseline.mean,
              thresholds: baseline.thresholds,
            }
          : null,
      });
    }

    return detailedMetrics;
  }

  private async getComparisonData(startDate: Date, endDate: Date): Promise<ReportData> {
    const patterns = await this.evaluationResultRepo
      .createQueryBuilder('result')
      .select('DISTINCT result.patternType', 'patternType')
      .getRawMany();

    const comparisons: Array<{
      pattern: string;
      summary: any;
      topMetrics: any[];
    }> = [];

    for (const { patternType } of patterns) {
      const summary = await this.getBaseReportData(startDate, endDate, patternType);
      const metrics = await this.getDetailedMetrics(startDate, endDate, patternType);

      comparisons.push({
        pattern: patternType,
        summary,
        topMetrics: metrics.slice(0, 3),
      });
    }

    return {
      title: 'Pattern Comparison Report',
      generatedAt: new Date(),
      period: { start: startDate, end: endDate },
      summary: await this.getBaseReportData(startDate, endDate),
      comparisons,
    } as any;
  }

  private async getTrendData(
    startDate: Date,
    endDate: Date,
    patternType?: string,
    metrics?: string[],
  ): Promise<any[]> {
    const trendMetrics: Array<{
      name: string;
      timeSeries: any;
      statistics: any;
      trend: any;
    }> = [];
    const metricsToAnalyze = metrics || ['overall', 'accuracy', 'performance'];

    for (const metric of metricsToAnalyze) {
      const timeSeries = await this.aggregationService.calculateTimeSeriesMetrics(
        patternType || 'all',
        metric,
        startDate,
        endDate,
        'day',
      );

      trendMetrics.push({
        name: metric,
        timeSeries,
        statistics: this.calculateTrendStatistics(timeSeries),
        trend: this.analyzeTrendDirection(timeSeries),
      });
    }

    return trendMetrics;
  }

  private async getFailureData(
    startDate: Date,
    endDate: Date,
    patternType?: string,
  ): Promise<any[]> {
    const where: any = {
      lastSeen: Between(startDate, endDate),
    };

    if (patternType) {
      where.patternType = patternType;
    }

    const failurePatterns = await this.failurePatternRepo.find({
      where,
      order: { impactScore: 'DESC' },
    });

    return failurePatterns.map((pattern) => ({
      pattern: pattern.patternType,
      category: pattern.category,
      count: pattern.occurrenceCount,
      impact: pattern.impactScore,
      status: pattern.status,
      rootCause: pattern.rootCauseAnalysis?.identifiedCause || 'Unknown',
      suggestedFixes: pattern.rootCauseAnalysis?.suggestedFixes || [],
    }));
  }

  private async generatePdfReport(
    data: ReportData,
    dto: GenerateReportDto,
  ): Promise<{ format: string; content: Buffer; filename: string }> {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));

    // Title Page
    doc.fontSize(24).text(data.title, { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Generated on: ${data.generatedAt.toLocaleString()}`, {
      align: 'center',
    });
    doc.moveDown();
    doc.text(
      `Period: ${data.period.start.toLocaleDateString()} - ${data.period.end.toLocaleDateString()}`,
      { align: 'center' },
    );

    // Summary Section
    doc.addPage();
    doc.fontSize(18).text('Executive Summary', { underline: true });
    doc.moveDown();
    doc.fontSize(12);
    doc.text(`Total Evaluations: ${data.summary.totalEvaluations}`);
    doc.text(`Average Score: ${(data.summary.averageScore * 100).toFixed(2)}%`);
    doc.text(`Success Rate: ${data.summary.successRate.toFixed(2)}%`);

    // Pattern Breakdown
    doc.moveDown();
    doc.fontSize(14).text('Pattern Performance', { underline: true });
    doc.fontSize(10);

    for (const pattern of data.summary.patternBreakdown) {
      doc.moveDown(0.5);
      doc.text(`${pattern.pattern}:`);
      doc.text(`  Evaluations: ${pattern.count}`);
      doc.text(`  Average Score: ${(pattern.avgScore * 100).toFixed(2)}%`);
    }

    // Metrics Section (if available)
    if (data.metrics) {
      doc.addPage();
      doc.fontSize(18).text('Metrics Analysis', { underline: true });
      doc.moveDown();

      for (const metric of data.metrics) {
        doc.fontSize(14).text(metric.name, { underline: true });
        doc.fontSize(10);
        doc.text(`Average: ${(metric.statistics.average * 100).toFixed(2)}%`);
        doc.text(`Min: ${(metric.statistics.min * 100).toFixed(2)}%`);
        doc.text(`Max: ${(metric.statistics.max * 100).toFixed(2)}%`);
        doc.text(`Std Dev: ${(metric.statistics.stdDev * 100).toFixed(2)}%`);
        if (metric.trend) {
          doc.text(`Trend: ${metric.trend.direction} (${metric.trend.changePercent.toFixed(2)}%)`);
        }
        doc.moveDown();
      }
    }

    // Failures Section (if available)
    if (data.failures && data.failures.length > 0) {
      doc.addPage();
      doc.fontSize(18).text('Failure Analysis', { underline: true });
      doc.moveDown();

      for (const failure of data.failures) {
        doc.fontSize(12).text(`${failure.pattern} - ${failure.category}`, {
          underline: true,
        });
        doc.fontSize(10);
        doc.text(`Occurrences: ${failure.count}`);
        doc.text(`Impact Score: ${(failure.impact * 100).toFixed(2)}%`);
        doc.text(`Status: ${failure.status}`);
        if (failure.rootCause) {
          doc.text(`Root Cause: ${failure.rootCause}`);
        }
        doc.moveDown();
      }
    }

    // Recommendations
    if (data.recommendations && data.recommendations.length > 0) {
      doc.addPage();
      doc.fontSize(18).text('Recommendations', { underline: true });
      doc.moveDown();
      doc.fontSize(10);

      data.recommendations.forEach((rec, index) => {
        doc.text(`${index + 1}. ${rec}`);
        doc.moveDown(0.5);
      });
    }

    doc.end();

    return new Promise((resolve) => {
      doc.on('end', () => {
        const content = Buffer.concat(chunks);
        const filename = `${dto.reportType}-report-${Date.now()}.pdf`;
        resolve({ format: 'pdf', content, filename });
      });
    });
  }

  private generateJsonReport(data: ReportData): any {
    return {
      format: 'json',
      content: data,
      filename: `report-${Date.now()}.json`,
    };
  }

  private async generateCsvReport(
    data: ReportData,
    dto: GenerateReportDto,
  ): Promise<{ format: string; content: string; filename: string }> {
    let csv = '';

    switch (dto.reportType) {
      case 'detailed':
      case 'trend':
        csv = this.generateMetricsCsv(data);
        break;
      case 'summary':
        csv = this.generateSummaryCsv(data);
        break;
      default:
        throw new Error(`CSV format not supported for ${dto.reportType} report`);
    }

    return {
      format: 'csv',
      content: csv,
      filename: `${dto.reportType}-report-${Date.now()}.csv`,
    };
  }

  private generateMetricsCsv(data: ReportData): string {
    const headers = ['Metric', 'Average', 'Min', 'Max', 'StdDev', 'Count', 'Trend'];
    const rows: string[] = [headers.join(',')];

    if (data.metrics) {
      for (const metric of data.metrics) {
        const row = [
          metric.name,
          metric.statistics.average.toFixed(4),
          metric.statistics.min.toFixed(4),
          metric.statistics.max.toFixed(4),
          metric.statistics.stdDev.toFixed(4),
          metric.statistics.count,
          metric.trend?.direction || 'N/A',
        ];
        rows.push(row.join(','));
      }
    }

    return rows.join('\n');
  }

  private generateSummaryCsv(data: ReportData): string {
    const headers = ['Pattern', 'Evaluations', 'Average Score', 'Success Rate'];
    const rows: string[] = [headers.join(',')];

    for (const pattern of data.summary.patternBreakdown) {
      const row = [
        pattern.pattern,
        pattern.count,
        pattern.avgScore.toFixed(4),
        'N/A', // Success rate would need to be calculated per pattern
      ];
      rows.push(row.join(','));
    }

    return rows.join('\n');
  }

  private getReportTitle(reportType: string, patternType?: string): string {
    const baseTitle = {
      summary: 'Executive Summary Report',
      detailed: 'Detailed Analysis Report',
      comparison: 'Pattern Comparison Report',
      trend: 'Trend Analysis Report',
      failure: 'Failure Analysis Report',
    }[reportType] || 'Evaluation Report';

    return patternType ? `${baseTitle} - ${patternType}` : baseTitle;
  }

  private calculateTrendStatistics(timeSeries: any[]): any {
    if (timeSeries.length === 0) {
      return { average: 0, volatility: 0, trend: 'stable' };
    }

    const scores = timeSeries.map((point) => point.avgScore);
    const average = scores.reduce((a, b) => a + b, 0) / scores.length;

    const variance =
      scores.reduce((sum, score) => {
        return sum + Math.pow(score - average, 2);
      }, 0) / scores.length;

    return {
      average,
      volatility: Math.sqrt(variance),
      dataPoints: scores.length,
    };
  }

  private analyzeTrendDirection(timeSeries: any[]): any {
    if (timeSeries.length < 2) {
      return { direction: 'stable', confidence: 0 };
    }

    const firstHalf = timeSeries.slice(0, Math.floor(timeSeries.length / 2));
    const secondHalf = timeSeries.slice(Math.floor(timeSeries.length / 2));

    const firstAvg = firstHalf.reduce((sum, p) => sum + p.avgScore, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, p) => sum + p.avgScore, 0) / secondHalf.length;

    const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100;

    let direction: 'improving' | 'stable' | 'degrading' = 'stable';
    if (Math.abs(changePercent) > 5) {
      direction = changePercent > 0 ? 'improving' : 'degrading';
    }

    return {
      direction,
      changePercent,
      confidence: Math.min(Math.abs(changePercent) / 10, 1),
    };
  }

  private async generateRecommendations(data: ReportData): Promise<string[]> {
    const recommendations: string[] = [];

    // Performance-based recommendations
    if (data.summary.averageScore < 0.7) {
      recommendations.push(
        'Overall performance is below target. Consider reviewing evaluation criteria and test cases.',
      );
    }

    if (data.summary.successRate < 90) {
      recommendations.push(
        'Success rate indicates reliability issues. Implement better error handling and retry mechanisms.',
      );
    }

    // Pattern-specific recommendations
    for (const pattern of data.summary.patternBreakdown) {
      if (pattern.avgScore < 0.6) {
        recommendations.push(
          `${pattern.pattern} pattern shows poor performance. Focus optimization efforts here.`,
        );
      }
    }

    // Failure-based recommendations
    if (data.failures) {
      const criticalFailures = data.failures.filter((f) => f.impact > 0.7);
      if (criticalFailures.length > 0) {
        recommendations.push(
          `${criticalFailures.length} critical failure patterns detected. Prioritize resolution of these issues.`,
        );
      }
    }

    // Trend-based recommendations
    if (data.metrics) {
      const degradingMetrics = data.metrics.filter((m) => m.trend?.direction === 'degrading');
      if (degradingMetrics.length > 0) {
        recommendations.push(
          `${degradingMetrics.length} metrics showing degradation. Monitor closely and investigate root causes.`,
        );
      }
    }

    return recommendations;
  }
}
