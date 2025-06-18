import { Injectable, Logger } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { v4 as uuidv4 } from 'uuid';
import { AgentPattern } from '../../enums/agent-pattern.enum';
import {
  ScheduledEvaluation,
  ScheduleConfig,
  ScheduleType,
  ScheduleHistory,
  ScheduleRunStatus,
  ScheduleJobOptions,
} from '../interfaces/scheduling.interface';
import { BatchProcessorService } from '../processors/batch-processor.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class EvaluationSchedulerService {
  private readonly logger = new Logger(EvaluationSchedulerService.name);
  private readonly schedules = new Map<string, ScheduledEvaluation>();

  constructor(
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly batchProcessor: BatchProcessorService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.initializeDefaultSchedules();
  }

  async createSchedule(
    name: string,
    schedule: ScheduleConfig,
    evaluationConfig: any,
  ): Promise<ScheduledEvaluation> {
    const scheduledEvaluation: ScheduledEvaluation = {
      id: uuidv4(),
      name,
      schedule,
      evaluation: evaluationConfig,
      enabled: true,
      history: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.schedules.set(scheduledEvaluation.id, scheduledEvaluation);

    if (scheduledEvaluation.enabled) {
      this.registerCronJob(scheduledEvaluation);
    }

    return scheduledEvaluation;
  }

  async updateSchedule(
    scheduleId: string,
    updates: Partial<ScheduledEvaluation>,
  ): Promise<ScheduledEvaluation> {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) {
      throw new Error(`Schedule ${scheduleId} not found`);
    }

    const wasEnabled = schedule.enabled;
    Object.assign(schedule, updates, { updatedAt: new Date() });

    if (wasEnabled && !schedule.enabled) {
      this.unregisterCronJob(scheduleId);
    } else if (!wasEnabled && schedule.enabled) {
      this.registerCronJob(schedule);
    } else if (schedule.enabled && updates.schedule) {
      this.unregisterCronJob(scheduleId);
      this.registerCronJob(schedule);
    }

    this.schedules.set(scheduleId, schedule);
    return schedule;
  }

  async deleteSchedule(scheduleId: string): Promise<void> {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) {
      throw new Error(`Schedule ${scheduleId} not found`);
    }

    if (schedule.enabled) {
      this.unregisterCronJob(scheduleId);
    }

    this.schedules.delete(scheduleId);
  }

  async getSchedule(scheduleId: string): Promise<ScheduledEvaluation> {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) {
      throw new Error(`Schedule ${scheduleId} not found`);
    }
    return schedule;
  }

  async getAllSchedules(): Promise<ScheduledEvaluation[]> {
    return Array.from(this.schedules.values());
  }

  async runScheduledJob(options: ScheduleJobOptions): Promise<void> {
    const schedule = this.schedules.get(options.scheduleId);
    if (!schedule) {
      throw new Error(`Schedule ${options.scheduleId} not found`);
    }

    if (options.skipIfRunning && this.isScheduleRunning(schedule)) {
      this.logger.warn(`Schedule ${schedule.name} is already running, skipping`);
      return;
    }

    const runId = uuidv4();
    const historyEntry: ScheduleHistory = {
      runId,
      batchJobId: '',
      startedAt: new Date(),
      status: ScheduleRunStatus.SUCCESS,
    };

    try {
      this.eventEmitter.emit('schedule.run.started', { schedule, runId });

      const batchJob = await this.batchProcessor.createBatchJob(
        `Scheduled: ${schedule.name}`,
        schedule.evaluation.patterns,
        schedule.evaluation.testSuiteIds,
        schedule.evaluation.batchConfig,
      );

      historyEntry.batchJobId = batchJob.id;

      const results = await this.batchProcessor.executeBatch(batchJob.id);

      historyEntry.completedAt = new Date();
      historyEntry.summary = {
        totalTests: results.summary.totalTests,
        passedTests: results.summary.passedTests,
        failedTests: results.summary.failedTests,
        duration: results.summary.duration,
      };

      if (results.summary.failedTests > 0) {
        historyEntry.status = ScheduleRunStatus.PARTIAL;
      }

      schedule.lastRun = historyEntry.startedAt;
      this.updateNextRun(schedule);

      this.eventEmitter.emit('schedule.run.completed', {
        schedule,
        runId,
        results,
      });
    } catch (error) {
      this.logger.error(`Scheduled job ${schedule.name} failed`, error);
      historyEntry.status = ScheduleRunStatus.ERROR;
      historyEntry.error = error.message;
      historyEntry.completedAt = new Date();

      this.eventEmitter.emit('schedule.run.failed', {
        schedule,
        runId,
        error,
      });
    }

    schedule.history.push(historyEntry);

    if (schedule.history.length > 100) {
      schedule.history = schedule.history.slice(-100);
    }
  }

  private registerCronJob(schedule: ScheduledEvaluation): void {
    const cronExpression = this.getCronExpression(schedule.schedule);

    const job = new CronJob(
      cronExpression,
      () => {
        this.runScheduledJob({
          scheduleId: schedule.id,
          skipIfRunning: true,
        }).catch((error) => {
          this.logger.error(`Failed to run scheduled job ${schedule.name}`, error);
        });
      },
      null,
      true,
      schedule.schedule.timezone || 'UTC',
    );

    this.schedulerRegistry.addCronJob(schedule.id, job);
    this.updateNextRun(schedule);

    this.logger.log(`Registered cron job for schedule ${schedule.name}`);
  }

  private unregisterCronJob(scheduleId: string): void {
    try {
      this.schedulerRegistry.deleteCronJob(scheduleId);
      this.logger.log(`Unregistered cron job ${scheduleId}`);
    } catch (error) {
      this.logger.warn(`Failed to unregister cron job ${scheduleId}`, error);
    }
  }

  private getCronExpression(config: ScheduleConfig): string {
    switch (config.type) {
      case ScheduleType.CRON:
        return config.cronExpression!;

      case ScheduleType.INTERVAL:
        const minutes = Math.floor(config.interval! / 60000);
        return `*/${minutes} * * * *`;

      case ScheduleType.DAILY:
        return `${config.minute || 0} ${config.hour || 0} * * *`;

      case ScheduleType.WEEKLY:
        return `${config.minute || 0} ${config.hour || 0} * * ${config.dayOfWeek || 0}`;

      case ScheduleType.MONTHLY:
        return `${config.minute || 0} ${config.hour || 0} 1 * *`;

      default:
        throw new Error(`Unsupported schedule type: ${config.type}`);
    }
  }

  private updateNextRun(schedule: ScheduledEvaluation): void {
    try {
      const job = this.schedulerRegistry.getCronJob(schedule.id);
      if (job) {
        schedule.nextRun = job.nextDate().toJSDate();
      }
    } catch (error) {
      this.logger.warn(`Failed to update next run for ${schedule.name}`, error);
    }
  }

  private isScheduleRunning(schedule: ScheduledEvaluation): boolean {
    if (schedule.history.length === 0) return false;

    const lastRun = schedule.history[schedule.history.length - 1];
    return !lastRun.completedAt;
  }

  private initializeDefaultSchedules(): void {
    const schedules = [
      {
        name: 'Daily Comprehensive Evaluation',
        schedule: {
          type: ScheduleType.DAILY,
          hour: 2,
          minute: 0,
          timezone: 'UTC',
        },
        evaluation: {
          patterns: Object.values(AgentPattern),
          testSuiteIds: ['comprehensive'],
          batchConfig: {
            parallel: true,
            maxConcurrency: 5,
          },
        },
      },
      {
        name: 'Hourly Quick Check',
        schedule: {
          type: ScheduleType.INTERVAL,
          interval: 3600000,
        },
        evaluation: {
          patterns: Object.values(AgentPattern),
          testSuiteIds: ['quick'],
          batchConfig: {
            parallel: true,
            maxConcurrency: 10,
          },
        },
      },
      {
        name: 'Weekly Regression Test',
        schedule: {
          type: ScheduleType.WEEKLY,
          dayOfWeek: 0,
          hour: 3,
          minute: 0,
          timezone: 'UTC',
        },
        evaluation: {
          patterns: Object.values(AgentPattern),
          testSuiteIds: ['regression'],
          batchConfig: {
            parallel: false,
          },
        },
      },
    ];

    schedules.forEach((config) => {
      this.createSchedule(config.name, config.schedule as ScheduleConfig, config.evaluation).catch(
        (error) => {
          this.logger.error(`Failed to create default schedule ${config.name}`, error);
        },
      );
    });
  }
}
