import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TestRunnerService } from '../services/test-runner.service';
import { TestSuiteService } from '../services/test-suite.service';
import { BatchProcessorService } from '../processors/batch-processor.service';
import { EvaluationSchedulerService } from '../schedulers/evaluation-scheduler.service';
import { EvaluationQueueService } from '../queues/evaluation-queue.service';
import { MetricsService } from '../services/metrics.service';
import { WorkflowOrchestratorService } from '../services/workflow-orchestrator.service';
import { EvaluationCacheService } from '../services/evaluation-cache.service';
import { AgentPattern } from '../../enums/agent-pattern.enum';
import { MetricPeriod } from '../interfaces/metrics.interface';

@Controller('automation')
export class AutomationController {
  constructor(
    private readonly testRunner: TestRunnerService,
    private readonly testSuiteService: TestSuiteService,
    private readonly batchProcessor: BatchProcessorService,
    private readonly scheduler: EvaluationSchedulerService,
    private readonly queue: EvaluationQueueService,
    private readonly metrics: MetricsService,
    private readonly workflow: WorkflowOrchestratorService,
    private readonly cache: EvaluationCacheService,
  ) {}

  // Test Runner Endpoints
  @Post('run')
  async runTests(@Body() options: any) {
    return this.testRunner.run(options);
  }

  @Get('run/:runId')
  async getTestRunStatus(@Param('runId') runId: string) {
    return this.testRunner.getStatus(runId);
  }

  @Post('run/:runId/cancel')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancelTestRun(@Param('runId') runId: string) {
    await this.testRunner.cancel(runId);
  }

  // Test Suite Endpoints
  @Get('suites')
  async getAllTestSuites() {
    return this.testSuiteService.getAllSuites();
  }

  @Get('suites/:suiteId')
  async getTestSuite(@Param('suiteId') suiteId: string) {
    return this.testSuiteService.getSuite(suiteId);
  }

  @Post('suites')
  async createTestSuite(@Body() suite: any) {
    return this.testSuiteService.createSuite(suite);
  }

  @Put('suites/:suiteId')
  async updateTestSuite(
    @Param('suiteId') suiteId: string,
    @Body() updates: any,
  ) {
    return this.testSuiteService.updateSuite(suiteId, updates);
  }

  @Delete('suites/:suiteId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTestSuite(@Param('suiteId') suiteId: string) {
    await this.testSuiteService.deleteSuite(suiteId);
  }

  // Batch Processing Endpoints
  @Post('batch')
  async createBatchJob(@Body() body: any) {
    const { name, patterns, testSuiteIds, config } = body;
    return this.batchProcessor.createBatchJob(
      name,
      patterns,
      testSuiteIds,
      config,
    );
  }

  @Get('batch')
  async getAllBatchJobs() {
    return this.batchProcessor.getAllBatches();
  }

  @Get('batch/:jobId')
  async getBatchJobStatus(@Param('jobId') jobId: string) {
    return this.batchProcessor.getBatchStatus(jobId);
  }

  @Post('batch/:jobId/cancel')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancelBatchJob(@Param('jobId') jobId: string) {
    await this.batchProcessor.cancelBatch(jobId);
  }

  // Scheduling Endpoints
  @Get('schedules')
  async getAllSchedules() {
    return this.scheduler.getAllSchedules();
  }

  @Get('schedules/:scheduleId')
  async getSchedule(@Param('scheduleId') scheduleId: string) {
    return this.scheduler.getSchedule(scheduleId);
  }

  @Post('schedules')
  async createSchedule(@Body() body: any) {
    const { name, schedule, evaluation } = body;
    return this.scheduler.createSchedule(name, schedule, evaluation);
  }

  @Put('schedules/:scheduleId')
  async updateSchedule(
    @Param('scheduleId') scheduleId: string,
    @Body() updates: any,
  ) {
    return this.scheduler.updateSchedule(scheduleId, updates);
  }

  @Delete('schedules/:scheduleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSchedule(@Param('scheduleId') scheduleId: string) {
    await this.scheduler.deleteSchedule(scheduleId);
  }

  @Post('schedules/:scheduleId/run')
  @HttpCode(HttpStatus.NO_CONTENT)
  async runScheduledJob(@Param('scheduleId') scheduleId: string) {
    await this.scheduler.runScheduledJob({ scheduleId, immediate: true });
  }

  // Queue Management Endpoints
  @Get('queue/metrics')
  async getQueueMetrics() {
    return this.queue.getQueueMetrics();
  }

  @Post('queue/pause')
  @HttpCode(HttpStatus.NO_CONTENT)
  async pauseQueue() {
    await this.queue.pauseQueue();
  }

  @Post('queue/resume')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resumeQueue() {
    await this.queue.resumeQueue();
  }

  @Post('queue/clear')
  @HttpCode(HttpStatus.NO_CONTENT)
  async clearQueue() {
    await this.queue.clearQueue();
  }

  @Get('queue/dead-letter')
  async getDeadLetterQueue() {
    return this.queue.getDeadLetterQueue();
  }

  @Post('queue/retry/:jobId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async retryFailedJob(@Param('jobId') jobId: string) {
    await this.queue.retryFailedJob(jobId);
  }

  // Metrics Endpoints
  @Get('metrics')
  async getMetrics(
    @Query('period') period: MetricPeriod = MetricPeriod.HOUR,
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
  ) {
    return this.metrics.getAggregatedMetrics(
      period,
      startTime ? new Date(startTime) : undefined,
      endTime ? new Date(endTime) : undefined,
    );
  }

  @Get('metrics/pattern/:pattern')
  async getPatternMetrics(
    @Param('pattern') pattern: AgentPattern,
    @Query('period') period: MetricPeriod = MetricPeriod.HOUR,
  ) {
    return this.metrics.getPatternMetrics(pattern, period);
  }

  @Get('metrics/system')
  async getSystemMetrics() {
    return this.metrics.getCurrentSystemMetrics();
  }

  @Get('metrics/alerts')
  async getAlerts(@Query('active') active: boolean = true) {
    return this.metrics.getAlerts(active);
  }

  @Post('metrics/alerts/:alertId/resolve')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resolveAlert(@Param('alertId') alertId: string) {
    this.metrics.resolveAlert(alertId);
  }

  @Get('metrics/export')
  async exportMetrics(@Query('format') format: 'json' | 'csv' = 'json') {
    return this.metrics.exportMetrics(format);
  }

  // Workflow Endpoints
  @Post('workflows')
  async createWorkflow(@Body() workflow: any) {
    return this.workflow.createWorkflow(workflow);
  }

  @Post('workflows/:workflowId/execute')
  async executeWorkflow(
    @Param('workflowId') workflowId: string,
    @Body() context: any = {},
  ) {
    return this.workflow.executeWorkflow(workflowId, context);
  }

  @Post('workflows/execution/:executionId/pause')
  @HttpCode(HttpStatus.NO_CONTENT)
  async pauseWorkflow(@Param('executionId') executionId: string) {
    await this.workflow.pauseWorkflow(executionId);
  }

  @Post('workflows/execution/:executionId/resume')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resumeWorkflow(@Param('executionId') executionId: string) {
    await this.workflow.resumeWorkflow(executionId);
  }

  @Post('workflows/execution/:executionId/cancel')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancelWorkflow(@Param('executionId') executionId: string) {
    await this.workflow.cancelWorkflow(executionId);
  }

  // Cache Management Endpoints
  @Get('cache/stats')
  async getCacheStats() {
    return this.cache.getStats();
  }

  @Delete('cache')
  @HttpCode(HttpStatus.NO_CONTENT)
  async clearCache() {
    await this.cache.invalidateAll();
  }

  @Delete('cache/pattern/:pattern')
  @HttpCode(HttpStatus.NO_CONTENT)
  async invalidatePatternCache(@Param('pattern') pattern: AgentPattern) {
    await this.cache.invalidatePattern(pattern);
  }

  @Post('cache/warmup')
  @HttpCode(HttpStatus.NO_CONTENT)
  async warmupCache() {
    await this.cache.warmupCache();
  }
}