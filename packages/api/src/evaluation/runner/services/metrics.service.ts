import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import {
  PerformanceMetrics,
  MetricOperation,
  TokenUsageMetrics,
  SystemMetrics,
  AggregatedMetrics,
  MetricPeriod,
  PatternMetrics,
  TotalMetrics,
  SystemHealthMetrics,
  ErrorMetrics,
  MetricAlert,
  AlertType,
  AlertSeverity,
} from '../interfaces/metrics.interface';
import { AgentPattern } from '../../enums/agent-pattern.enum';

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly logger = new Logger(MetricsService.name);
  private readonly performanceMetrics: PerformanceMetrics[] = [];
  private readonly tokenUsageMetrics: TokenUsageMetrics[] = [];
  private readonly systemMetrics: SystemMetrics[] = [];
  private readonly errorMetrics: Map<string, ErrorMetrics> = new Map();
  private readonly alerts: Map<string, MetricAlert> = new Map();

  private readonly maxMetricsRetention = 7 * 24 * 60 * 60 * 1000; // 7 days
  private systemMetricsInterval: NodeJS.Timeout | undefined;
  private cleanupInterval: NodeJS.Timeout | undefined;
  private aggregationInterval: NodeJS.Timeout | undefined;

  private readonly alertThresholds = {
    errorRate: 0.1, // 10%
    latencyP95: 5000, // 5 seconds
    tokenUsagePerMinute: 100000,
    cpuUsage: 80, // 80%
    memoryUsage: 85, // 85%
    queueBackup: 1000,
    cacheMissRate: 0.5, // 50%
  };

  constructor(private readonly eventEmitter: EventEmitter2) {}

  onModuleInit() {
    this.startSystemMetricsCollection();
    this.startMetricsCleanup();
    this.startAggregation();
  }

  recordPerformance(
    pattern: AgentPattern,
    operation: MetricOperation,
    duration: number,
    success: boolean,
    metadata?: Record<string, any>,
  ): void {
    const metric: PerformanceMetrics = {
      timestamp: new Date(),
      pattern,
      operation,
      duration,
      success,
      metadata,
    };

    this.performanceMetrics.push(metric);
    this.checkPerformanceAlerts(pattern, operation, duration, success);
  }

  recordTokenUsage(
    pattern: AgentPattern,
    inputTokens: number,
    outputTokens: number,
    model?: string,
  ): void {
    const metric: TokenUsageMetrics = {
      pattern,
      timestamp: new Date(),
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      cost: this.calculateCost(inputTokens + outputTokens, model),
      model,
    };

    this.tokenUsageMetrics.push(metric);
    this.checkTokenUsageAlerts(pattern, metric.totalTokens);
  }

  recordError(pattern: AgentPattern | undefined, error: any): void {
    const errorKey = `${pattern || 'global'}-${error.constructor.name}`;
    const existing = this.errorMetrics.get(errorKey);

    if (existing) {
      existing.count++;
    } else {
      this.errorMetrics.set(errorKey, {
        timestamp: new Date(),
        pattern,
        errorType: error.constructor.name,
        count: 1,
        message: error.message,
        stack: error.stack,
      });
    }

    this.checkErrorRateAlerts(pattern);
  }

  @OnEvent('evaluation.completed')
  handleEvaluationCompleted(event: any): void {
    this.recordPerformance(event.pattern, MetricOperation.EVALUATION, event.duration, true, {
      score: event.result.score,
    });
  }

  @OnEvent('evaluation.failed')
  handleEvaluationFailed(event: any): void {
    this.recordPerformance(event.pattern, MetricOperation.EVALUATION, event.duration || 0, false, {
      error: event.error.message,
    });
    this.recordError(event.pattern, event.error);
  }

  @OnEvent('cache.hit')
  handleCacheHit(event: any): void {
    this.recordPerformance(event.pattern, MetricOperation.CACHE_HIT, event.responseTime, true);
  }

  @OnEvent('cache.miss')
  handleCacheMiss(event: any): void {
    this.recordPerformance(event.pattern, MetricOperation.CACHE_MISS, event.responseTime, true);
  }

  async getAggregatedMetrics(
    period: MetricPeriod,
    startTime?: Date,
    endTime?: Date,
  ): Promise<AggregatedMetrics> {
    const now = new Date();
    const start = startTime || this.getStartTimeForPeriod(period, now);
    const end = endTime || now;

    const relevantPerformanceMetrics = this.performanceMetrics.filter(
      (m) => m.timestamp >= start && m.timestamp <= end,
    );

    const relevantTokenMetrics = this.tokenUsageMetrics.filter(
      (m) => m.timestamp >= start && m.timestamp <= end,
    );

    const patterns = new Map<AgentPattern, PatternMetrics>();

    for (const pattern of Object.values(AgentPattern)) {
      const patternMetrics = this.calculatePatternMetrics(
        pattern,
        relevantPerformanceMetrics,
        relevantTokenMetrics,
      );
      patterns.set(pattern, patternMetrics);
    }

    const totals = this.calculateTotalMetrics(
      relevantPerformanceMetrics,
      relevantTokenMetrics,
      start,
      end,
    );

    const system = await this.calculateSystemHealthMetrics(start, end);

    return {
      period,
      startTime: start,
      endTime: end,
      patterns,
      totals,
      system,
    };
  }

  async getCurrentSystemMetrics(): Promise<SystemMetrics> {
    const cpuUsage = await this.getCpuUsage();
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();

    return {
      timestamp: new Date(),
      cpu: {
        usage: cpuUsage,
        loadAverage: os.loadavg(),
      },
      memory: {
        used: memUsage.heapUsed,
        total: totalMem,
        percentage: (memUsage.heapUsed / totalMem) * 100,
      },
      evaluations: {
        active: this.getActiveEvaluations(),
        queued: this.getQueuedEvaluations(),
        completed: this.getCompletedEvaluations(),
        failed: this.getFailedEvaluations(),
      },
    };
  }

  getAlerts(active: boolean = true): MetricAlert[] {
    const alerts = Array.from(this.alerts.values());
    return active ? alerts.filter((a) => !a.resolved) : alerts;
  }

  resolveAlert(alertId: string): void {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.resolved = true;
      this.eventEmitter.emit('metrics.alert.resolved', alert);
    }
  }

  getPatternMetrics(
    pattern: AgentPattern,
    period: MetricPeriod = MetricPeriod.HOUR,
  ): PatternMetrics {
    const now = new Date();
    const start = this.getStartTimeForPeriod(period, now);

    const relevantPerformanceMetrics = this.performanceMetrics.filter(
      (m) => m.pattern === pattern && m.timestamp >= start,
    );

    const relevantTokenMetrics = this.tokenUsageMetrics.filter(
      (m) => m.pattern === pattern && m.timestamp >= start,
    );

    return this.calculatePatternMetrics(pattern, relevantPerformanceMetrics, relevantTokenMetrics);
  }

  exportMetrics(format: 'json' | 'csv' = 'json'): string {
    const data = {
      performance: this.performanceMetrics,
      tokenUsage: this.tokenUsageMetrics,
      system: this.systemMetrics,
      errors: Array.from(this.errorMetrics.values()),
      alerts: Array.from(this.alerts.values()),
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    } else {
      // CSV export implementation
      return this.convertToCSV(data);
    }
  }

  private calculatePatternMetrics(
    pattern: AgentPattern,
    performanceMetrics: PerformanceMetrics[],
    tokenMetrics: TokenUsageMetrics[],
  ): PatternMetrics {
    const evaluations = performanceMetrics.filter(
      (m) => m.pattern === pattern && m.operation === MetricOperation.EVALUATION,
    );

    const durations = evaluations.map((e) => e.duration).sort((a, b) => a - b);
    const successful = evaluations.filter((e) => e.success).length;
    const failed = evaluations.filter((e) => !e.success).length;

    const cacheHits = performanceMetrics.filter(
      (m) => m.pattern === pattern && m.operation === MetricOperation.CACHE_HIT,
    ).length;

    const cacheMisses = performanceMetrics.filter(
      (m) => m.pattern === pattern && m.operation === MetricOperation.CACHE_MISS,
    ).length;

    const totalCacheRequests = cacheHits + cacheMisses;
    const hitRate = totalCacheRequests > 0 ? cacheHits / totalCacheRequests : 0;

    const patternTokens = tokenMetrics.filter((m) => m.pattern === pattern);
    const totalTokens = patternTokens.reduce((sum, m) => sum + m.totalTokens, 0);
    const totalCost = patternTokens.reduce((sum, m) => sum + (m.cost || 0), 0);

    const errors = Array.from(this.errorMetrics.values()).filter((e) => e.pattern === pattern);

    return {
      pattern,
      evaluations: {
        total: evaluations.length,
        successful,
        failed,
        avgDuration:
          durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
        p95Duration: this.percentile(durations, 0.95),
        p99Duration: this.percentile(durations, 0.99),
      },
      tokens: {
        total: totalTokens,
        avgPerEvaluation: evaluations.length > 0 ? totalTokens / evaluations.length : 0,
        cost: totalCost,
      },
      cache: {
        hits: cacheHits,
        misses: cacheMisses,
        hitRate,
      },
      errors,
    };
  }

  private calculateTotalMetrics(
    performanceMetrics: PerformanceMetrics[],
    tokenMetrics: TokenUsageMetrics[],
    startTime: Date,
    endTime: Date,
  ): TotalMetrics {
    const evaluations = performanceMetrics.filter(
      (m) => m.operation === MetricOperation.EVALUATION,
    );

    const successful = evaluations.filter((e) => e.success).length;
    const durations = evaluations.map((e) => e.duration);
    const avgDuration =
      durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

    const totalTokens = tokenMetrics.reduce((sum, m) => sum + m.totalTokens, 0);
    const totalCost = tokenMetrics.reduce((sum, m) => sum + (m.cost || 0), 0);

    const timeRangeMinutes = (endTime.getTime() - startTime.getTime()) / 60000;

    return {
      evaluations: evaluations.length,
      successRate: evaluations.length > 0 ? successful / evaluations.length : 0,
      avgDuration,
      totalTokens,
      totalCost,
      throughput: {
        evaluationsPerMinute: evaluations.length / timeRangeMinutes,
        tokensPerMinute: totalTokens / timeRangeMinutes,
      },
    };
  }

  private async calculateSystemHealthMetrics(
    startTime: Date,
    endTime: Date,
  ): Promise<SystemHealthMetrics> {
    const relevantSystemMetrics = this.systemMetrics.filter(
      (m) => m.timestamp >= startTime && m.timestamp <= endTime,
    );

    const cpuUsages = relevantSystemMetrics.map((m) => m.cpu.usage);
    const memoryUsages = relevantSystemMetrics.map((m) => m.memory.percentage);

    const uptime = process.uptime() * 1000;

    return {
      uptime,
      avgCpuUsage:
        cpuUsages.length > 0 ? cpuUsages.reduce((a, b) => a + b, 0) / cpuUsages.length : 0,
      avgMemoryUsage:
        memoryUsages.length > 0 ? memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length : 0,
      peakCpuUsage: Math.max(...cpuUsages, 0),
      peakMemoryUsage: Math.max(...memoryUsages, 0),
      queueHealth: {
        avgWaitTime: 0, // Would be calculated from queue metrics
        maxWaitTime: 0,
        deadLetterCount: 0,
      },
    };
  }

  private checkPerformanceAlerts(
    pattern: AgentPattern,
    operation: MetricOperation,
    duration: number,
    success: boolean,
  ): void {
    if (!success) return;

    if (duration > this.alertThresholds.latencyP95) {
      this.createAlert({
        type: AlertType.LATENCY,
        severity: AlertSeverity.WARNING,
        pattern,
        metric: 'duration',
        threshold: this.alertThresholds.latencyP95,
        currentValue: duration,
        message: `High latency detected for ${pattern}: ${duration}ms`,
      });
    }
  }

  private checkTokenUsageAlerts(pattern: AgentPattern, tokens: number): void {
    const recentTokens = this.tokenUsageMetrics
      .filter((m) => m.pattern === pattern && m.timestamp.getTime() > Date.now() - 60000)
      .reduce((sum, m) => sum + m.totalTokens, 0);

    if (recentTokens > this.alertThresholds.tokenUsagePerMinute) {
      this.createAlert({
        type: AlertType.TOKEN_USAGE,
        severity: AlertSeverity.WARNING,
        pattern,
        metric: 'tokensPerMinute',
        threshold: this.alertThresholds.tokenUsagePerMinute,
        currentValue: recentTokens,
        message: `High token usage for ${pattern}: ${recentTokens} tokens/minute`,
      });
    }
  }

  private checkErrorRateAlerts(pattern?: AgentPattern): void {
    const recentEvaluations = this.performanceMetrics.filter(
      (m) =>
        m.operation === MetricOperation.EVALUATION &&
        (!pattern || m.pattern === pattern) &&
        m.timestamp.getTime() > Date.now() - 300000, // Last 5 minutes
    );

    if (recentEvaluations.length === 0) return;

    const failures = recentEvaluations.filter((m) => !m.success).length;
    const errorRate = failures / recentEvaluations.length;

    if (errorRate > this.alertThresholds.errorRate) {
      this.createAlert({
        type: AlertType.ERROR_RATE,
        severity: AlertSeverity.ERROR,
        pattern,
        metric: 'errorRate',
        threshold: this.alertThresholds.errorRate,
        currentValue: errorRate,
        message: `High error rate${pattern ? ` for ${pattern}` : ''}: ${(errorRate * 100).toFixed(1)}%`,
      });
    }
  }

  private createAlert(alert: Omit<MetricAlert, 'id' | 'timestamp'>): void {
    const id = uuidv4();
    const fullAlert: MetricAlert = {
      id,
      timestamp: new Date(),
      ...alert,
    };

    this.alerts.set(id, fullAlert);
    this.eventEmitter.emit('metrics.alert.created', fullAlert);
  }

  private startSystemMetricsCollection(): void {
    this.systemMetricsInterval = setInterval(async () => {
      const metrics = await this.getCurrentSystemMetrics();
      this.systemMetrics.push(metrics);

      if (metrics.cpu.usage > this.alertThresholds.cpuUsage) {
        this.createAlert({
          type: AlertType.SYSTEM_RESOURCE,
          severity: AlertSeverity.WARNING,
          metric: 'cpuUsage',
          threshold: this.alertThresholds.cpuUsage,
          currentValue: metrics.cpu.usage,
          message: `High CPU usage: ${metrics.cpu.usage.toFixed(1)}%`,
        });
      }

      if (metrics.memory.percentage > this.alertThresholds.memoryUsage) {
        this.createAlert({
          type: AlertType.SYSTEM_RESOURCE,
          severity: AlertSeverity.WARNING,
          metric: 'memoryUsage',
          threshold: this.alertThresholds.memoryUsage,
          currentValue: metrics.memory.percentage,
          message: `High memory usage: ${metrics.memory.percentage.toFixed(1)}%`,
        });
      }
    }, 30000); // Every 30 seconds
  }

  private startMetricsCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const cutoffTime = Date.now() - this.maxMetricsRetention;

      this.performanceMetrics.splice(
        0,
        this.performanceMetrics.findIndex((m) => m.timestamp.getTime() > cutoffTime),
      );

      this.tokenUsageMetrics.splice(
        0,
        this.tokenUsageMetrics.findIndex((m) => m.timestamp.getTime() > cutoffTime),
      );

      this.systemMetrics.splice(
        0,
        this.systemMetrics.findIndex((m) => m.timestamp.getTime() > cutoffTime),
      );

      // Clean up old resolved alerts
      for (const [id, alert] of this.alerts.entries()) {
        if (alert.resolved && alert.timestamp.getTime() < cutoffTime) {
          this.alerts.delete(id);
        }
      }
    }, 3600000); // Every hour
  }

  private startAggregation(): void {
    this.aggregationInterval = setInterval(async () => {
      const hourlyMetrics = await this.getAggregatedMetrics(MetricPeriod.HOUR);
      this.eventEmitter.emit('metrics.aggregated', hourlyMetrics);
    }, 300000); // Every 5 minutes
  }

  private percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, index)];
  }

  private getStartTimeForPeriod(period: MetricPeriod, now: Date): Date {
    const time = new Date(now);

    switch (period) {
      case MetricPeriod.MINUTE:
        time.setMinutes(time.getMinutes() - 1);
        break;
      case MetricPeriod.HOUR:
        time.setHours(time.getHours() - 1);
        break;
      case MetricPeriod.DAY:
        time.setDate(time.getDate() - 1);
        break;
      case MetricPeriod.WEEK:
        time.setDate(time.getDate() - 7);
        break;
      case MetricPeriod.MONTH:
        time.setMonth(time.getMonth() - 1);
        break;
    }

    return time;
  }

  private async getCpuUsage(): Promise<number> {
    const cpus = os.cpus();
    const totalUsage = cpus.reduce((sum, cpu) => {
      const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
      const idle = cpu.times.idle;
      return sum + ((total - idle) / total) * 100;
    }, 0);
    return totalUsage / cpus.length;
  }

  private getActiveEvaluations(): number {
    // This would be implemented based on actual tracking
    return 0;
  }

  private getQueuedEvaluations(): number {
    // This would be implemented based on queue metrics
    return 0;
  }

  private getCompletedEvaluations(): number {
    return this.performanceMetrics.filter(
      (m) => m.operation === MetricOperation.EVALUATION && m.success,
    ).length;
  }

  private getFailedEvaluations(): number {
    return this.performanceMetrics.filter(
      (m) => m.operation === MetricOperation.EVALUATION && !m.success,
    ).length;
  }

  private calculateCost(tokens: number, model?: string): number {
    // Simplified cost calculation - would be based on actual model pricing
    const costPerToken = model?.includes('pro') ? 0.00002 : 0.00001;
    return tokens * costPerToken;
  }

  private convertToCSV(data: any): string {
    // Simplified CSV conversion
    const lines: string[] = [];

    // Performance metrics CSV
    lines.push('Type,Timestamp,Pattern,Operation,Duration,Success');
    for (const metric of data.performance) {
      lines.push(
        [
          'Performance',
          metric.timestamp.toISOString(),
          metric.pattern,
          metric.operation,
          metric.duration,
          metric.success,
        ].join(','),
      );
    }

    return lines.join('\n');
  }

  onModuleDestroy() {
    if (this.systemMetricsInterval) {
      clearInterval(this.systemMetricsInterval);
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    if (this.aggregationInterval) {
      clearInterval(this.aggregationInterval);
    }
  }
}
