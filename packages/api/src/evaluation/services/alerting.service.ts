import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, LessThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AlertConfiguration,
  AlertHistory,
  EvaluationResult,
  QualityBaseline,
} from '../../database/entities';
import { CreateAlertDto } from '../reporting/reporting.dto';

interface AlertConditionResult {
  triggered: boolean;
  currentValue: number;
  threshold: number;
  details: Record<string, any>;
}

interface NotificationPayload {
  alertName: string;
  severity: string;
  triggeredAt: Date;
  condition: string;
  currentValue: number;
  threshold: number;
  patternType?: string;
  message: string;
  actionRequired: string;
}

@Injectable()
export class AlertingService {
  private readonly logger = new Logger(AlertingService.name);

  constructor(
    @InjectRepository(AlertConfiguration)
    private alertConfigRepo: Repository<AlertConfiguration>,
    @InjectRepository(AlertHistory)
    private alertHistoryRepo: Repository<AlertHistory>,
    @InjectRepository(EvaluationResult)
    private evaluationResultRepo: Repository<EvaluationResult>,
    @InjectRepository(QualityBaseline)
    private qualityBaselineRepo: Repository<QualityBaseline>,
    private eventEmitter: EventEmitter2,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkAlerts(): Promise<void> {
    this.logger.log('Checking alert conditions...');

    const activeAlerts = await this.alertConfigRepo.find({
      where: { enabled: true },
    });

    for (const alert of activeAlerts) {
      try {
        await this.evaluateAlert(alert);
      } catch (error) {
        this.logger.error(`Failed to evaluate alert ${alert.name}: ${error.message}`);
      }
    }
  }

  async createAlertConfiguration(dto: CreateAlertDto): Promise<AlertConfiguration> {
    const alert = this.alertConfigRepo.create({
      name: dto.name,
      description: dto.description,
      patternType: dto.patternType,
      alertType: dto.alertType,
      conditions: dto.conditions,
      notificationChannels: dto.notificationChannels,
      enabled: dto.enabled ?? true,
      severity: dto.severity || 'medium',
      cooldownMinutes: dto.cooldownMinutes || 60,
    });

    return this.alertConfigRepo.save(alert);
  }

  async getAlertConfigurations(filters: {
    enabled?: boolean;
    patternType?: string;
  }): Promise<AlertConfiguration[]> {
    const where: any = {};
    if (filters.enabled !== undefined) where.enabled = filters.enabled;
    if (filters.patternType) where.patternType = filters.patternType;

    return this.alertConfigRepo.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async getAlertHistory(filters: {
    configurationId?: string;
    status?: 'triggered' | 'acknowledged' | 'resolved' | 'escalated';
    startDate?: Date;
    endDate?: Date;
  }): Promise<AlertHistory[]> {
    const query = this.alertHistoryRepo
      .createQueryBuilder('history')
      .leftJoinAndSelect('history.configuration', 'configuration')
      .orderBy('history.triggeredAt', 'DESC');

    if (filters.configurationId) {
      query.andWhere('history.configurationId = :configId', {
        configId: filters.configurationId,
      });
    }

    if (filters.status) {
      query.andWhere('history.status = :status', { status: filters.status });
    }

    if (filters.startDate) {
      query.andWhere('history.triggeredAt >= :startDate', {
        startDate: filters.startDate,
      });
    }

    if (filters.endDate) {
      query.andWhere('history.triggeredAt <= :endDate', {
        endDate: filters.endDate,
      });
    }

    return query.getMany();
  }

  async acknowledgeAlert(
    alertHistoryId: string,
    userId: string,
    notes?: string,
  ): Promise<AlertHistory> {
    const alert = await this.alertHistoryRepo.findOne({
      where: { id: alertHistoryId },
    });

    if (!alert) {
      throw new Error('Alert not found');
    }

    alert.status = 'acknowledged';
    alert.acknowledgedAt = new Date();
    alert.acknowledgedBy = userId;
    if (notes) alert.notes = notes;

    return this.alertHistoryRepo.save(alert);
  }

  async resolveAlert(alertHistoryId: string, notes?: string): Promise<AlertHistory> {
    const alert = await this.alertHistoryRepo.findOne({
      where: { id: alertHistoryId },
    });

    if (!alert) {
      throw new Error('Alert not found');
    }

    alert.status = 'resolved';
    alert.resolvedAt = new Date();
    if (notes) alert.notes = (alert.notes || '') + '\n' + notes;

    return this.alertHistoryRepo.save(alert);
  }

  private async evaluateAlert(config: AlertConfiguration): Promise<void> {
    // Check cooldown period
    const lastAlert = await this.alertHistoryRepo.findOne({
      where: {
        configurationId: config.id,
        triggeredAt: MoreThan(new Date(Date.now() - config.cooldownMinutes * 60 * 1000)),
      },
      order: { triggeredAt: 'DESC' },
    });

    if (lastAlert) {
      this.logger.debug(`Alert ${config.name} is in cooldown period`);
      return;
    }

    const result = await this.checkAlertCondition(config);

    if (result.triggered) {
      await this.triggerAlert(config, result);
    }
  }

  private async checkAlertCondition(config: AlertConfiguration): Promise<AlertConditionResult> {
    switch (config.alertType) {
      case 'score_degradation':
        return this.checkScoreDegradation(config);
      case 'failure_rate':
        return this.checkFailureRate(config);
      case 'performance':
        return this.checkPerformance(config);
      case 'anomaly':
        return this.checkAnomaly(config);
      default:
        throw new Error(`Unknown alert type: ${config.alertType}`);
    }
  }

  private async checkScoreDegradation(config: AlertConfiguration): Promise<AlertConditionResult> {
    const windowStart = new Date(Date.now() - (config.conditions.windowSize || 60) * 60 * 1000);

    const query = this.evaluationResultRepo
      .createQueryBuilder('result')
      .where('result.createdAt > :windowStart', { windowStart });

    if (config.patternType) {
      query.andWhere('result.patternType = :patternType', {
        patternType: config.patternType,
      });
    }

    if (config.conditions.metric) {
      query
        .leftJoin('result.metrics', 'metric')
        .andWhere('metric.name = :metricName', {
          metricName: config.conditions.metric,
        })
        .select('AVG(metric.score)', 'avgScore');
    } else {
      query.select('AVG(result.overallScore)', 'avgScore');
    }

    const result = await query.getRawOne();
    const currentValue = parseFloat(result?.avgScore || '0');

    const triggered = this.evaluateCondition(
      currentValue,
      config.conditions.operator,
      config.conditions.threshold,
    );

    return {
      triggered,
      currentValue,
      threshold: config.conditions.threshold,
      details: {
        windowSize: config.conditions.windowSize || 60,
        metric: config.conditions.metric || 'overall',
      },
    };
  }

  private async checkFailureRate(config: AlertConfiguration): Promise<AlertConditionResult> {
    const windowStart = new Date(Date.now() - (config.conditions.windowSize || 60) * 60 * 1000);

    const query = this.evaluationResultRepo
      .createQueryBuilder('result')
      .where('result.createdAt > :windowStart', { windowStart });

    if (config.patternType) {
      query.andWhere('result.patternType = :patternType', {
        patternType: config.patternType,
      });
    }

    const totalCount = await query.getCount();
    const failureCount = await query.andWhere('result.success = false').getCount();

    const failureRate = totalCount > 0 ? (failureCount / totalCount) * 100 : 0;

    const triggered = this.evaluateCondition(
      failureRate,
      config.conditions.operator,
      config.conditions.threshold,
    );

    return {
      triggered,
      currentValue: failureRate,
      threshold: config.conditions.threshold,
      details: {
        totalEvaluations: totalCount,
        failedEvaluations: failureCount,
        windowSize: config.conditions.windowSize || 60,
      },
    };
  }

  private async checkPerformance(config: AlertConfiguration): Promise<AlertConditionResult> {
    const windowStart = new Date(Date.now() - (config.conditions.windowSize || 60) * 60 * 1000);

    const query = this.evaluationResultRepo
      .createQueryBuilder('result')
      .where('result.createdAt > :windowStart', { windowStart })
      .select('AVG(result.executionTimeMs)', 'avgTime');

    if (config.patternType) {
      query.andWhere('result.patternType = :patternType', {
        patternType: config.patternType,
      });
    }

    const result = await query.getRawOne();
    const avgExecutionTime = parseFloat(result?.avgTime || '0');

    const triggered = this.evaluateCondition(
      avgExecutionTime,
      config.conditions.operator,
      config.conditions.threshold,
    );

    return {
      triggered,
      currentValue: avgExecutionTime,
      threshold: config.conditions.threshold,
      details: {
        metric: 'executionTimeMs',
        windowSize: config.conditions.windowSize || 60,
      },
    };
  }

  private async checkAnomaly(config: AlertConfiguration): Promise<AlertConditionResult> {
    const baseline = await this.qualityBaselineRepo.findOne({
      where: {
        patternType: config.patternType,
        metricName: config.conditions.metric || 'overall',
        periodType: 'weekly',
      },
    });

    if (!baseline) {
      return {
        triggered: false,
        currentValue: 0,
        threshold: config.conditions.threshold,
        details: { error: 'No baseline found' },
      };
    }

    const windowStart = new Date(Date.now() - (config.conditions.windowSize || 60) * 60 * 1000);

    const query = this.evaluationResultRepo
      .createQueryBuilder('result')
      .where('result.createdAt > :windowStart', { windowStart });

    if (config.patternType) {
      query.andWhere('result.patternType = :patternType', {
        patternType: config.patternType,
      });
    }

    if (config.conditions.metric) {
      query
        .leftJoin('result.metrics', 'metric')
        .andWhere('metric.name = :metricName', {
          metricName: config.conditions.metric,
        })
        .select('metric.score', 'score');
    } else {
      query.select('result.overallScore', 'score');
    }

    const results = await query.getRawMany();
    const scores = results.map((r) => parseFloat(r.score));

    const anomalyCount = scores.filter((score) => {
      const zScore = Math.abs(score - baseline.mean) / baseline.stdDeviation;
      return zScore > config.conditions.threshold;
    }).length;

    const anomalyRate = scores.length > 0 ? (anomalyCount / scores.length) * 100 : 0;

    return {
      triggered: anomalyRate > 10, // Trigger if more than 10% are anomalies
      currentValue: anomalyRate,
      threshold: config.conditions.threshold,
      details: {
        anomalyCount,
        totalCount: scores.length,
        baselineMean: baseline.mean,
        baselineStdDev: baseline.stdDeviation,
      },
    };
  }

  private evaluateCondition(value: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case 'lt':
        return value < threshold;
      case 'lte':
        return value <= threshold;
      case 'gt':
        return value > threshold;
      case 'gte':
        return value >= threshold;
      case 'eq':
        return Math.abs(value - threshold) < 0.001;
      case 'neq':
        return Math.abs(value - threshold) >= 0.001;
      default:
        return false;
    }
  }

  private async triggerAlert(
    config: AlertConfiguration,
    result: AlertConditionResult,
  ): Promise<void> {
    const alertHistory = this.alertHistoryRepo.create({
      configurationId: config.id,
      triggeredAt: new Date(),
      triggerData: {
        currentValue: result.currentValue,
        threshold: result.threshold,
        metric: config.conditions.metric || 'overall',
        patternType: config.patternType,
        ...result.details,
      },
      status: 'triggered',
    });

    const savedHistory = await this.alertHistoryRepo.save(alertHistory);

    const payload = this.createNotificationPayload(config, result);

    // Send notifications
    const notificationResults = await this.sendNotifications(config.notificationChannels, payload);

    // Update history with notification results
    savedHistory.notificationResults = notificationResults;
    await this.alertHistoryRepo.save(savedHistory);

    // Emit event for other systems to react
    this.eventEmitter.emit('alert.triggered', {
      configuration: config,
      history: savedHistory,
      payload,
    });

    this.logger.warn(`Alert triggered: ${config.name} - ${payload.message}`);
  }

  private createNotificationPayload(
    config: AlertConfiguration,
    result: AlertConditionResult,
  ): NotificationPayload {
    const conditionText = `${config.conditions.metric || 'overall'} ${
      config.conditions.operator
    } ${config.conditions.threshold}`;

    let message = '';
    let actionRequired = '';

    switch (config.alertType) {
      case 'score_degradation':
        message = `Score degradation detected: ${result.currentValue.toFixed(3)} (threshold: ${result.threshold})`;
        actionRequired = 'Review recent evaluations and identify root causes';
        break;
      case 'failure_rate':
        message = `High failure rate: ${result.currentValue.toFixed(2)}% (threshold: ${result.threshold}%)`;
        actionRequired = 'Investigate failing evaluations and system health';
        break;
      case 'performance':
        message = `Performance issue: average execution time ${result.currentValue.toFixed(0)}ms (threshold: ${result.threshold}ms)`;
        actionRequired = 'Check system resources and optimize slow operations';
        break;
      case 'anomaly':
        message = `Anomaly detected: ${result.currentValue.toFixed(2)}% of evaluations are anomalous`;
        actionRequired = 'Review anomalous evaluations for unusual patterns';
        break;
    }

    return {
      alertName: config.name,
      severity: config.severity,
      triggeredAt: new Date(),
      condition: conditionText,
      currentValue: result.currentValue,
      threshold: result.threshold,
      patternType: config.patternType,
      message,
      actionRequired,
    };
  }

  private async sendNotifications(
    channels: Array<{ type: string; config: Record<string, any> }>,
    payload: NotificationPayload,
  ): Promise<any[]> {
    const results: Array<{
      channel: string;
      success: boolean;
      sentAt: Date;
      error?: string;
    }> = [];

    for (const channel of channels) {
      try {
        const result = await this.sendNotification(channel, payload);
        results.push({
          channel: channel.type,
          success: true,
          sentAt: new Date(),
        });
      } catch (error) {
        results.push({
          channel: channel.type,
          success: false,
          error: error.message,
          sentAt: new Date(),
        });
      }
    }

    return results;
  }

  private async sendNotification(
    channel: { type: string; config: Record<string, any> },
    payload: NotificationPayload,
  ): Promise<void> {
    switch (channel.type) {
      case 'log':
        this.logger.warn(`ALERT: ${payload.alertName}`, payload);
        break;
      case 'email':
        // Implement email notification
        this.logger.log(`Would send email to ${channel.config.to}: ${payload.message}`);
        break;
      case 'slack':
        // Implement Slack notification
        this.logger.log(
          `Would send Slack message to ${channel.config.webhook}: ${payload.message}`,
        );
        break;
      case 'webhook':
        // Implement webhook notification
        this.logger.log(`Would call webhook ${channel.config.url} with payload`);
        break;
      default:
        throw new Error(`Unknown notification channel: ${channel.type}`);
    }
  }

  async testAlertConfiguration(alertId: string): Promise<any> {
    const config = await this.alertConfigRepo.findOne({
      where: { id: alertId },
    });

    if (!config) {
      throw new Error('Alert configuration not found');
    }

    const result = await this.checkAlertCondition(config);

    return {
      configuration: config,
      testResult: result,
      wouldTrigger: result.triggered,
      currentValue: result.currentValue,
      threshold: result.threshold,
      details: result.details,
    };
  }
}
