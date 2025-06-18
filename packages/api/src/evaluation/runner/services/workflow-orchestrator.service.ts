import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';
import {
  Workflow,
  WorkflowStage,
  WorkflowStatus,
  WorkflowResults,
  WorkflowExecution,
  WorkflowContext,
  WorkflowState,
  WorkflowCheckpoint,
  StageResult,
  StageStatus,
  StageType,
  ConditionType,
  WorkflowSummary,
} from '../interfaces/workflow.interface';
import { TestRunnerService } from './test-runner.service';
import { BatchProcessorService } from '../processors/batch-processor.service';
import { ApiTestingService } from './api-testing.service';
import { EvaluationQueueService } from '../queues/evaluation-queue.service';
import { JobType, JobPriority } from '../interfaces/queue.interface';

@Injectable()
export class WorkflowOrchestratorService {
  private readonly logger = new Logger(WorkflowOrchestratorService.name);
  private readonly activeWorkflows = new Map<string, WorkflowExecution>();
  private readonly workflows = new Map<string, Workflow>();

  constructor(
    private readonly testRunner: TestRunnerService,
    private readonly batchProcessor: BatchProcessorService,
    private readonly apiTesting: ApiTestingService,
    private readonly queueService: EvaluationQueueService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.initializeDefaultWorkflows();
  }

  async createWorkflow(workflow: Partial<Workflow>): Promise<Workflow> {
    const id = workflow.id || uuidv4();
    const newWorkflow: Workflow = {
      id,
      name: workflow.name || 'Unnamed Workflow',
      description: workflow.description,
      stages: workflow.stages || [],
      config: workflow.config || {},
      status: WorkflowStatus.PENDING,
      ...workflow,
    };

    this.validateWorkflow(newWorkflow);
    this.workflows.set(id, newWorkflow);
    
    return newWorkflow;
  }

  async executeWorkflow(
    workflowId: string,
    initialContext?: Record<string, any>,
  ): Promise<WorkflowResults> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const executionId = uuidv4();
    const context: WorkflowContext = {
      variables: new Map(Object.entries(initialContext || {})),
      artifacts: new Map(),
      stageOutputs: new Map(),
    };

    const execution: WorkflowExecution = {
      workflowId,
      executionId,
      status: WorkflowStatus.RUNNING,
      context,
      stateManager: this.createStateManager(workflow, context),
    };

    this.activeWorkflows.set(executionId, execution);
    workflow.status = WorkflowStatus.RUNNING;
    workflow.startedAt = new Date();

    this.eventEmitter.emit('workflow.started', { workflow, executionId });

    try {
      const results = await this.runWorkflow(workflow, execution);
      
      workflow.status = WorkflowStatus.COMPLETED;
      workflow.completedAt = new Date();
      workflow.results = results;

      this.eventEmitter.emit('workflow.completed', { workflow, executionId, results });
      
      return results;
    } catch (error) {
      this.logger.error(`Workflow ${workflowId} failed`, error);
      
      workflow.status = WorkflowStatus.FAILED;
      workflow.completedAt = new Date();

      if (workflow.config.rollbackOnFailure) {
        await this.rollbackWorkflow(execution);
      }

      this.eventEmitter.emit('workflow.failed', { workflow, executionId, error });
      
      throw error;
    } finally {
      this.activeWorkflows.delete(executionId);
    }
  }

  async pauseWorkflow(executionId: string): Promise<void> {
    const execution = this.activeWorkflows.get(executionId);
    if (!execution) {
      throw new Error(`Workflow execution ${executionId} not found`);
    }

    execution.status = WorkflowStatus.PAUSED;
    this.eventEmitter.emit('workflow.paused', { executionId });
  }

  async resumeWorkflow(executionId: string): Promise<void> {
    const execution = this.activeWorkflows.get(executionId);
    if (!execution) {
      throw new Error(`Workflow execution ${executionId} not found`);
    }

    execution.status = WorkflowStatus.RUNNING;
    this.eventEmitter.emit('workflow.resumed', { executionId });
  }

  async cancelWorkflow(executionId: string): Promise<void> {
    const execution = this.activeWorkflows.get(executionId);
    if (!execution) {
      throw new Error(`Workflow execution ${executionId} not found`);
    }

    execution.status = WorkflowStatus.CANCELLED;
    this.activeWorkflows.delete(executionId);
    
    this.eventEmitter.emit('workflow.cancelled', { executionId });
  }

  private async runWorkflow(
    workflow: Workflow,
    execution: WorkflowExecution,
  ): Promise<WorkflowResults> {
    const results: WorkflowResults = {
      stages: new Map(),
      summary: {
        totalStages: workflow.stages.length,
        completedStages: 0,
        failedStages: 0,
        skippedStages: 0,
        duration: 0,
        success: true,
      },
      artifacts: [],
    };

    const startTime = Date.now();
    const executionOrder = this.topologicalSort(workflow.stages);

    for (const stageId of executionOrder) {
      if (execution.status === WorkflowStatus.CANCELLED) {
        break;
      }

      if (execution.status === WorkflowStatus.PAUSED) {
        await this.waitForResume(execution);
      }

      const stage = workflow.stages.find(s => s.id === stageId);
      if (!stage) continue;

      const shouldRun = await this.evaluateStageCondition(stage, execution, results);
      
      if (!shouldRun) {
        results.stages.set(stageId, {
          stageId,
          status: StageStatus.SKIPPED,
          startedAt: new Date(),
        });
        results.summary.skippedStages++;
        continue;
      }

      workflow.currentStage = stageId;
      const stageResult = await this.executeStage(stage, execution, workflow);
      
      results.stages.set(stageId, stageResult);

      if (stageResult.status === StageStatus.COMPLETED) {
        results.summary.completedStages++;
        execution.context.stageOutputs.set(stageId, stageResult.output);
      } else {
        results.summary.failedStages++;
        
        if (!workflow.config.allowPartialSuccess) {
          results.summary.success = false;
          throw new Error(`Stage ${stageId} failed`);
        }
      }

      this.eventEmitter.emit('workflow.stage.completed', {
        workflow,
        stage,
        result: stageResult,
      });
    }

    results.summary.duration = Date.now() - startTime;
    return results;
  }

  private async executeStage(
    stage: WorkflowStage,
    execution: WorkflowExecution,
    workflow: Workflow,
  ): Promise<StageResult> {
    const startedAt = new Date();
    let attempts = 0;
    const maxAttempts = stage.retryPolicy?.maxAttempts || 1;

    while (attempts < maxAttempts) {
      try {
        attempts++;
        
        const output = await this.runStageByType(stage, execution, workflow);
        
        return {
          stageId: stage.id,
          status: StageStatus.COMPLETED,
          startedAt,
          completedAt: new Date(),
          duration: new Date().getTime() - startedAt.getTime(),
          output,
          retries: attempts - 1,
        };
      } catch (error) {
        this.logger.error(`Stage ${stage.id} attempt ${attempts} failed`, error);
        
        if (attempts >= maxAttempts) {
          return {
            stageId: stage.id,
            status: StageStatus.FAILED,
            startedAt,
            completedAt: new Date(),
            duration: new Date().getTime() - startedAt.getTime(),
            error: error.message,
            retries: attempts - 1,
          };
        }

        const backoff = Math.min(
          1000 * Math.pow(stage.retryPolicy?.backoffMultiplier || 2, attempts - 1),
          stage.retryPolicy?.maxBackoff || 30000,
        );
        
        await this.delay(backoff);
      }
    }

    throw new Error(`Stage ${stage.id} failed after ${attempts} attempts`);
  }

  private async runStageByType(
    stage: WorkflowStage,
    execution: WorkflowExecution,
    workflow: Workflow,
  ): Promise<any> {
    switch (stage.type) {
      case StageType.EVALUATION:
        return this.runEvaluationStage(stage, execution);
      
      case StageType.BATCH:
        return this.runBatchStage(stage, execution);
      
      case StageType.API_TEST:
        return this.runApiTestStage(stage, execution);
      
      case StageType.VALIDATION:
        return this.runValidationStage(stage, execution);
      
      case StageType.NOTIFICATION:
        return this.runNotificationStage(stage, execution);
      
      case StageType.CONDITIONAL:
        return this.runConditionalStage(stage, execution);
      
      case StageType.PARALLEL:
        return this.runParallelStage(stage, execution, workflow);
      
      case StageType.APPROVAL:
        return this.runApprovalStage(stage, execution);
      
      default:
        throw new Error(`Unknown stage type: ${stage.type}`);
    }
  }

  private async runEvaluationStage(
    stage: WorkflowStage,
    execution: WorkflowExecution,
  ): Promise<any> {
    const patterns = stage.config.patterns || [];
    const testSuiteIds = stage.config.testSuiteIds || [];

    const job = await this.queueService.addJob(
      JobType.SINGLE_EVALUATION,
      {
        patterns,
        testSuiteId: testSuiteIds[0],
        metadata: { workflowId: execution.workflowId, stageId: stage.id },
      },
      { timeout: stage.timeout },
      JobPriority.HIGH,
    );

    return { jobId: job.id, patterns, testSuiteIds };
  }

  private async runBatchStage(
    stage: WorkflowStage,
    execution: WorkflowExecution,
  ): Promise<any> {
    const patterns = stage.config.patterns || [];
    const testSuiteIds = stage.config.testSuiteIds || [];

    const batchJob = await this.batchProcessor.createBatchJob(
      `Workflow: ${execution.workflowId} - Stage: ${stage.id}`,
      patterns,
      testSuiteIds,
      {},
    );

    const results = await this.batchProcessor.executeBatch(batchJob.id);
    return results;
  }

  private async runApiTestStage(
    stage: WorkflowStage,
    execution: WorkflowExecution,
  ): Promise<any> {
    const patterns = stage.config.patterns || [];
    const results = [];

    for (const pattern of patterns) {
      const result = await this.apiTesting.testEndpoint(
        {
          pattern,
          method: 'POST',
          body: stage.config.customData,
        },
        {
          baseUrl: process.env.API_BASE_URL || 'http://localhost:3001',
          timeout: stage.timeout || 30000,
          retries: 3,
          retryDelay: 1000,
        },
      );
      results.push(result);
    }

    return results;
  }

  private async runValidationStage(
    stage: WorkflowStage,
    execution: WorkflowExecution,
  ): Promise<any> {
    const rules = stage.config.validationRules || [];
    const results = [];

    for (const rule of rules) {
      const value = this.getValueFromContext(rule.field, execution.context);
      const passed = this.evaluateValidationRule(rule, value);
      
      results.push({
        field: rule.field,
        passed,
        value,
        message: passed ? 'Validation passed' : rule.errorMessage || 'Validation failed',
      });

      if (!passed) {
        throw new Error(rule.errorMessage || `Validation failed for ${rule.field}`);
      }
    }

    return results;
  }

  private async runNotificationStage(
    stage: WorkflowStage,
    execution: WorkflowExecution,
  ): Promise<any> {
    const config = stage.config.notificationConfig;
    
    this.eventEmitter.emit('workflow.notification', {
      workflowId: execution.workflowId,
      stageId: stage.id,
      config,
      context: execution.context,
    });

    return { notified: true, config };
  }

  private async runConditionalStage(
    stage: WorkflowStage,
    execution: WorkflowExecution,
  ): Promise<any> {
    // Conditional logic would be implemented here
    return { executed: true };
  }

  private async runParallelStage(
    stage: WorkflowStage,
    execution: WorkflowExecution,
    workflow: Workflow,
  ): Promise<any> {
    const parallelStageIds = stage.config.parallelStages || [];
    const parallelStages = workflow.stages.filter(s => parallelStageIds.includes(s.id));

    const promises = parallelStages.map(s => this.executeStage(s, execution, workflow));
    const results = await Promise.all(promises);

    return results.reduce((acc, result, index) => {
      acc[parallelStages[index].id] = result;
      return acc;
    }, {});
  }

  private async runApprovalStage(
    stage: WorkflowStage,
    execution: WorkflowExecution,
  ): Promise<any> {
    const approvalConfig = stage.config.approvalConfig;
    
    this.eventEmitter.emit('workflow.approval.requested', {
      workflowId: execution.workflowId,
      stageId: stage.id,
      approvalConfig,
    });

    // In a real implementation, this would wait for approvals
    // For now, we'll simulate auto-approval after a delay
    if (approvalConfig?.autoApproveAfterTimeout) {
      await this.delay(5000);
      return { approved: true, approvers: ['auto-approved'] };
    }

    return { approved: true, approvers: ['system'] };
  }

  private async evaluateStageCondition(
    stage: WorkflowStage,
    execution: WorkflowExecution,
    results: WorkflowResults,
  ): Promise<boolean> {
    if (!stage.condition) return true;

    switch (stage.condition.type) {
      case ConditionType.ALWAYS:
        return true;
      
      case ConditionType.ON_SUCCESS:
        const prevStage = stage.dependencies?.[0];
        if (!prevStage) return true;
        return results.stages.get(prevStage)?.status === StageStatus.COMPLETED;
      
      case ConditionType.ON_FAILURE:
        const failedStage = stage.dependencies?.[0];
        if (!failedStage) return false;
        return results.stages.get(failedStage)?.status === StageStatus.FAILED;
      
      case ConditionType.EXPRESSION:
        // Evaluate custom expression
        return true;
      
      case ConditionType.THRESHOLD:
        const value = this.getValueFromContext(
          stage.condition.field || '',
          execution.context,
        );
        return value >= (stage.condition.threshold || 0);
      
      default:
        return true;
    }
  }

  private validateWorkflow(workflow: Workflow): void {
    // Check for circular dependencies
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    for (const stage of workflow.stages) {
      if (this.hasCycle(stage.id, workflow.stages, visited, recursionStack)) {
        throw new Error('Workflow contains circular dependencies');
      }
    }

    // Validate stage IDs are unique
    const stageIds = workflow.stages.map(s => s.id);
    if (new Set(stageIds).size !== stageIds.length) {
      throw new Error('Workflow contains duplicate stage IDs');
    }
  }

  private hasCycle(
    stageId: string,
    stages: WorkflowStage[],
    visited: Set<string>,
    recursionStack: Set<string>,
  ): boolean {
    visited.add(stageId);
    recursionStack.add(stageId);

    const stage = stages.find(s => s.id === stageId);
    if (!stage) return false;

    for (const dep of stage.dependencies || []) {
      if (!visited.has(dep)) {
        if (this.hasCycle(dep, stages, visited, recursionStack)) {
          return true;
        }
      } else if (recursionStack.has(dep)) {
        return true;
      }
    }

    recursionStack.delete(stageId);
    return false;
  }

  private topologicalSort(stages: WorkflowStage[]): string[] {
    const visited = new Set<string>();
    const stack: string[] = [];

    const visit = (stageId: string) => {
      if (visited.has(stageId)) return;
      visited.add(stageId);

      const stage = stages.find(s => s.id === stageId);
      if (!stage) return;

      for (const dep of stage.dependencies || []) {
        visit(dep);
      }

      stack.push(stageId);
    };

    for (const stage of stages) {
      visit(stage.id);
    }

    return stack;
  }

  private createStateManager(
    workflow: Workflow,
    context: WorkflowContext,
  ): any {
    const checkpoints: WorkflowCheckpoint[] = [];
    let currentStage = '';

    return {
      getCurrentState: (): WorkflowState => ({
        currentStage,
        completedStages: Array.from(context.stageOutputs.keys()),
        pendingStages: workflow.stages
          .filter(s => !context.stageOutputs.has(s.id))
          .map(s => s.id),
        context,
        checkpoints,
      }),

      transition: (to: string) => {
        currentStage = to;
      },

      checkpoint: () => {
        checkpoints.push({
          id: uuidv4(),
          stageId: currentStage,
          timestamp: new Date(),
          state: {
            variables: Array.from(context.variables.entries()),
            artifacts: Array.from(context.artifacts.entries()),
            stageOutputs: Array.from(context.stageOutputs.entries()),
          },
        });
      },

      rollback: () => {
        const lastCheckpoint = checkpoints.pop();
        if (lastCheckpoint) {
          context.variables = new Map(lastCheckpoint.state.variables);
          context.artifacts = new Map(lastCheckpoint.state.artifacts);
          context.stageOutputs = new Map(lastCheckpoint.state.stageOutputs);
        }
      },
    };
  }

  private async rollbackWorkflow(execution: WorkflowExecution): Promise<void> {
    this.logger.log(`Rolling back workflow ${execution.workflowId}`);
    
    const workflow = this.workflows.get(execution.workflowId);
    if (!workflow) return;

    workflow.status = WorkflowStatus.ROLLING_BACK;
    
    // Rollback logic would be implemented here
    execution.stateManager.rollback();
    
    this.eventEmitter.emit('workflow.rolledback', { workflowId: execution.workflowId });
  }

  private getValueFromContext(path: string, context: WorkflowContext): any {
    const parts = path.split('.');
    let value: any = context;

    for (const part of parts) {
      if (part.startsWith('$')) {
        const varName = part.substring(1);
        value = context.variables.get(varName);
      } else if (value && typeof value === 'object') {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  private evaluateValidationRule(rule: any, value: any): boolean {
    switch (rule.operator) {
      case 'equals':
        return value === rule.value;
      case 'not-equals':
        return value !== rule.value;
      case 'greater-than':
        return value > rule.value;
      case 'less-than':
        return value < rule.value;
      case 'contains':
        return String(value).includes(rule.value);
      case 'matches':
        return new RegExp(rule.value).test(String(value));
      default:
        return false;
    }
  }

  private async waitForResume(execution: WorkflowExecution): Promise<void> {
    while (execution.status === WorkflowStatus.PAUSED) {
      await this.delay(1000);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private initializeDefaultWorkflows(): void {
    const comprehensiveEvaluationWorkflow: Workflow = {
      id: 'comprehensive-evaluation',
      name: 'Comprehensive Pattern Evaluation',
      description: 'Full evaluation workflow for all agent patterns',
      stages: [
        {
          id: 'pre-check',
          name: 'Pre-evaluation Health Check',
          type: StageType.API_TEST,
          config: {
            patterns: Object.values(AgentPattern),
          },
        },
        {
          id: 'batch-eval',
          name: 'Batch Evaluation',
          type: StageType.BATCH,
          config: {
            patterns: Object.values(AgentPattern),
            testSuiteIds: ['comprehensive'],
          },
          dependencies: ['pre-check'],
          condition: {
            type: ConditionType.ON_SUCCESS,
          },
        },
        {
          id: 'validation',
          name: 'Results Validation',
          type: StageType.VALIDATION,
          config: {
            validationRules: [
              {
                field: '$batchResults.summary.successRate',
                operator: 'greater-than',
                value: 0.8,
                errorMessage: 'Success rate below 80%',
              },
            ],
          },
          dependencies: ['batch-eval'],
        },
        {
          id: 'notification',
          name: 'Send Notifications',
          type: StageType.NOTIFICATION,
          config: {
            notificationConfig: {
              channels: ['email', 'slack'],
            },
          },
          dependencies: ['validation'],
        },
      ],
      config: {
        maxDuration: 3600000, // 1 hour
        allowPartialSuccess: true,
        rollbackOnFailure: false,
        notifications: {
          onStart: true,
          onComplete: true,
          onFailure: true,
        },
      },
      status: WorkflowStatus.PENDING,
    };

    this.workflows.set(comprehensiveEvaluationWorkflow.id, comprehensiveEvaluationWorkflow);
  }
}