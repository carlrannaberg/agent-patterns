import { Injectable } from '@nestjs/common';
import { PatternEvaluatorBase } from './pattern-evaluator.base';
import { AgentPattern } from '../enums/agent-pattern.enum';
import {
  TestCase,
  EvaluationResult,
  EvaluationConfig,
  MetricScore,
} from '../interfaces/evaluation.interface';

interface OrchestratorWorkerInput {
  featureRequest: string;
  projectContext: string;
  constraints?: string[];
  technologies?: string[];
}

interface TaskDefinition {
  id: string;
  title: string;
  description: string;
  dependencies: string[];
  assignedWorker: string;
  estimatedEffort?: string;
  priority: 'high' | 'medium' | 'low';
}

interface WorkerOutput {
  workerId: string;
  taskId: string;
  implementation: string;
  testsPassed: boolean;
  notes?: string;
}

interface OrchestratorWorkerResponse {
  plan: {
    overview: string;
    tasks: TaskDefinition[];
    timeline?: string;
    risks?: string[];
  };
  execution: {
    completedTasks: WorkerOutput[];
    inProgressTasks?: string[];
    blockedTasks?: string[];
  };
  summary: {
    successRate: number;
    implementationNotes: string;
    nextSteps?: string[];
  };
}

@Injectable()
export class OrchestratorWorkerEvaluator extends PatternEvaluatorBase {
  pattern = AgentPattern.ORCHESTRATOR_WORKER;

  generateTestCases(count: number, complexity?: 'simple' | 'moderate' | 'complex'): TestCase[] {
    const testCases: TestCase[] = [];
    const scenarios = this.getScenarios(complexity);

    for (let i = 0; i < count; i++) {
      const scenario = scenarios[i % scenarios.length];
      testCases.push(
        this.generateBaseTestCase(this.pattern, scenario.input, scenario.expectedBehavior, {
          complexity,
          category: scenario.category,
          expectedTaskCount: scenario.expectedTaskCount,
        }),
      );
    }

    return testCases;
  }

  async evaluateResponse(
    testCase: TestCase,
    response: OrchestratorWorkerResponse,
    config: EvaluationConfig,
  ): Promise<EvaluationResult> {
    const scores: MetricScore[] = [];

    // Task Decomposition
    if (config.metrics.includes('task_decomposition')) {
      const decompositionScore = this.evaluateTaskDecomposition(testCase, response);
      scores.push(decompositionScore);
    }

    // Worker Coordination
    if (config.metrics.includes('worker_coordination')) {
      const coordinationScore = this.evaluateWorkerCoordination(response);
      scores.push(coordinationScore);
    }

    // Implementation Correctness
    if (config.metrics.includes('implementation_correctness')) {
      const implementationScore = this.evaluateImplementationCorrectness(response);
      scores.push(implementationScore);
    }

    // Planning Quality
    const planningScore = this.evaluatePlanningQuality(testCase, response);
    scores.push(planningScore);

    // Execution Effectiveness
    const executionScore = this.evaluateExecutionEffectiveness(response);
    scores.push(executionScore);

    const overallScore = this.calculateWeightedScore(scores);
    const passed = overallScore >= (config.passingThreshold || 0.75);

    return {
      testCaseId: testCase.id,
      pattern: this.pattern,
      scores,
      overallScore,
      passed,
      feedback: this.generateFeedback(scores, response),
      timestamp: new Date().toISOString(),
    };
  }

  getEvaluationPrompt(
    metric: string,
    testCase: TestCase,
    response: OrchestratorWorkerResponse,
  ): string {
    const input = testCase.input as OrchestratorWorkerInput;

    switch (metric) {
      case 'task_decomposition':
        return `Evaluate the quality of task decomposition for the feature implementation:

Feature Request: ${input.featureRequest}
Project Context: ${input.projectContext}

Tasks Created: ${response.plan.tasks.length}
Task Titles:
${response.plan.tasks.map((t) => `- ${t.title}`).join('\n')}

Evaluation Criteria:
1. Appropriate granularity of tasks
2. Logical breakdown of the feature
3. Clear task boundaries and responsibilities
4. Consideration of all aspects of the feature
5. Reasonable scope for each task

Provide a score from 0-1 and detailed rationale.`;

      case 'worker_coordination':
        return `Evaluate the coordination between orchestrator and workers:

Total Tasks: ${response.plan.tasks.length}
Unique Workers: ${new Set(response.plan.tasks.map((t) => t.assignedWorker)).size}
Task Dependencies: ${response.plan.tasks.filter((t) => t.dependencies.length > 0).length} tasks with dependencies

Execution Status:
- Completed: ${response.execution.completedTasks.length}
- In Progress: ${response.execution.inProgressTasks?.length || 0}
- Blocked: ${response.execution.blockedTasks?.length || 0}

Evaluation Criteria:
1. Appropriate worker assignment
2. Dependency management
3. Parallel execution where possible
4. Clear communication of requirements
5. Handling of blocked tasks

Provide a score from 0-1 and detailed rationale.`;

      case 'implementation_correctness':
        return `Evaluate the correctness of the implementation:

Success Rate: ${response.summary.successRate}%
Tests Passed: ${response.execution.completedTasks.filter((t) => t.testsPassed).length}/${response.execution.completedTasks.length}

Implementation Notes: ${response.summary.implementationNotes}

Evaluation Criteria:
1. All critical tasks completed successfully
2. Test coverage and passing tests
3. Quality of individual implementations
4. Integration between components
5. Adherence to requirements

Provide a score from 0-1 and detailed rationale.`;

      default:
        return '';
    }
  }

  private evaluateTaskDecomposition(
    testCase: TestCase,
    response: OrchestratorWorkerResponse,
  ): MetricScore {
    const input = testCase.input as OrchestratorWorkerInput;
    const expectedTaskCount = testCase.metadata?.expectedTaskCount || 5;
    let score = 0;

    // Check task count reasonableness
    const taskCount = response.plan.tasks.length;
    if (taskCount >= expectedTaskCount - 2 && taskCount <= expectedTaskCount + 3) {
      score += 0.3;
    } else if (taskCount >= 2 && taskCount <= 15) {
      score += 0.15;
    }

    // Check task granularity
    const hasDetailedDescriptions = response.plan.tasks.every(
      (task) => task.description && task.description.length > 20,
    );
    if (hasDetailedDescriptions) {
      score += 0.2;
    }

    // Check for logical task types
    const taskTypes = this.categorizeTaskTypes(response.plan.tasks);
    if (taskTypes.size >= 3) {
      score += 0.2; // Good variety of task types
    }

    // Check priority distribution
    const priorities = response.plan.tasks.map((t) => t.priority);
    const hasHighPriority = priorities.includes('high');
    const hasMixedPriorities = new Set(priorities).size > 1;
    if (hasHighPriority && hasMixedPriorities) {
      score += 0.15;
    }

    // Check for feature coverage
    const featureKeywords = input.featureRequest
      .toLowerCase()
      .split(' ')
      .filter((word) => word.length > 3);
    const tasksCoverFeature = featureKeywords.some((keyword) =>
      response.plan.tasks.some(
        (task) =>
          task.title.toLowerCase().includes(keyword) ||
          task.description.toLowerCase().includes(keyword),
      ),
    );
    if (tasksCoverFeature) {
      score += 0.15;
    }

    return {
      metric: 'task_decomposition',
      score: this.normalizeScore(score),
      rationale: `Task decomposition quality based on granularity, coverage, and logical structure.`,
      weight: 1.5,
    };
  }

  private evaluateWorkerCoordination(response: OrchestratorWorkerResponse): MetricScore {
    let score = 0.3; // Base score

    // Check worker diversity
    const uniqueWorkers = new Set(response.plan.tasks.map((t) => t.assignedWorker));
    if (uniqueWorkers.size >= 2 && uniqueWorkers.size <= response.plan.tasks.length) {
      score += 0.2;
    }

    // Check dependency management
    const hasDependencies = response.plan.tasks.some((t) => t.dependencies.length > 0);
    const dependenciesValid = response.plan.tasks.every((task) =>
      task.dependencies.every((dep) =>
        response.plan.tasks.some((t) => t.id === dep && t.id !== task.id),
      ),
    );
    if (hasDependencies && dependenciesValid) {
      score += 0.2;
    }

    // Check execution coordination
    const completionRate = response.execution.completedTasks.length / response.plan.tasks.length;
    score += completionRate * 0.2;

    // Check for blocked task handling
    if (response.execution.blockedTasks && response.execution.blockedTasks.length > 0) {
      // Having blocked tasks identified is good
      score += 0.1;
    } else if (completionRate === 1) {
      // No blocked tasks and everything completed
      score += 0.1;
    }

    return {
      metric: 'worker_coordination',
      score: this.normalizeScore(score),
      rationale: `Worker coordination evaluated on assignment, dependencies, and execution management.`,
      weight: 1.3,
    };
  }

  private evaluateImplementationCorrectness(response: OrchestratorWorkerResponse): MetricScore {
    let score = 0;

    // Check success rate
    if (response.summary.successRate >= 90) {
      score += 0.4;
    } else if (response.summary.successRate >= 70) {
      score += 0.25;
    } else if (response.summary.successRate >= 50) {
      score += 0.1;
    }

    // Check test passing rate
    const completedTasks = response.execution.completedTasks;
    if (completedTasks.length > 0) {
      const testPassRate =
        completedTasks.filter((t) => t.testsPassed).length / completedTasks.length;
      score += testPassRate * 0.3;
    }

    // Check implementation quality indicators
    const hasImplementations = completedTasks.every(
      (t) => t.implementation && t.implementation.length > 50,
    );
    if (hasImplementations) {
      score += 0.2;
    }

    // Check for notes and documentation
    const hasNotes = completedTasks.filter((t) => t.notes && t.notes.length > 10).length;
    if (hasNotes > completedTasks.length * 0.5) {
      score += 0.1;
    }

    return {
      metric: 'implementation_correctness',
      score: this.normalizeScore(score),
      rationale: `Implementation correctness based on success rate, tests, and quality indicators.`,
      weight: 1.5,
    };
  }

  private evaluatePlanningQuality(
    testCase: TestCase,
    response: OrchestratorWorkerResponse,
  ): MetricScore {
    let score = 0.2; // Base score

    // Check plan overview
    if (response.plan.overview && response.plan.overview.length > 50) {
      score += 0.2;
    }

    // Check timeline presence
    if (response.plan.timeline && response.plan.timeline.length > 20) {
      score += 0.15;
    }

    // Check risk identification
    if (response.plan.risks && response.plan.risks.length > 0) {
      score += 0.2;
      if (response.plan.risks.length >= 2 && response.plan.risks.length <= 5) {
        score += 0.1; // Reasonable number of risks
      }
    }

    // Check effort estimation
    const tasksWithEstimates = response.plan.tasks.filter((t) => t.estimatedEffort).length;
    if (tasksWithEstimates > response.plan.tasks.length * 0.7) {
      score += 0.15;
    }

    return {
      metric: 'planning_quality',
      score: this.normalizeScore(score),
      rationale: `Planning quality assessed through overview, timeline, risks, and estimates.`,
      weight: 1.0,
    };
  }

  private evaluateExecutionEffectiveness(response: OrchestratorWorkerResponse): MetricScore {
    let score = 0;

    // Check completion percentage
    const totalTasks = response.plan.tasks.length;
    const completedTasks = response.execution.completedTasks.length;
    const completionRate = totalTasks > 0 ? completedTasks / totalTasks : 0;
    score += completionRate * 0.4;

    // Check for proper status tracking
    const hasStatusTracking =
      response.execution.inProgressTasks !== undefined ||
      response.execution.blockedTasks !== undefined;
    if (hasStatusTracking) {
      score += 0.2;
    }

    // Check implementation notes quality
    if (response.summary.implementationNotes && response.summary.implementationNotes.length > 50) {
      score += 0.2;
    }

    // Check for next steps
    if (response.summary.nextSteps && response.summary.nextSteps.length > 0) {
      score += 0.2;
    }

    return {
      metric: 'execution_effectiveness',
      score: this.normalizeScore(score),
      rationale: `Execution effectiveness based on completion rate and tracking quality.`,
      weight: 1.1,
    };
  }

  private categorizeTaskTypes(tasks: TaskDefinition[]): Set<string> {
    const types = new Set<string>();

    tasks.forEach((task) => {
      const lower = task.title.toLowerCase() + ' ' + task.description.toLowerCase();

      if (/backend|api|server|database|model/i.test(lower)) types.add('backend');
      if (/frontend|ui|component|react|view/i.test(lower)) types.add('frontend');
      if (/test|spec|coverage|quality/i.test(lower)) types.add('testing');
      if (/deploy|ci|cd|build|docker/i.test(lower)) types.add('devops');
      if (/document|readme|guide|comment/i.test(lower)) types.add('documentation');
      if (/design|mockup|wireframe|ux/i.test(lower)) types.add('design');
    });

    return types;
  }

  private generateFeedback(scores: MetricScore[], response: OrchestratorWorkerResponse): string {
    const feedback: string[] = [];
    const avgScore = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;

    if (avgScore >= 0.85) {
      feedback.push('Excellent orchestration with effective task planning and execution.');
    } else if (avgScore >= 0.7) {
      feedback.push('Good orchestration with some areas for improvement.');
    } else {
      feedback.push('Orchestration needs improvement in planning or execution.');
    }

    // Specific metrics
    feedback.push(
      `Created ${response.plan.tasks.length} tasks with ${response.execution.completedTasks.length} completed.`,
    );
    feedback.push(`Success rate: ${response.summary.successRate}%.`);

    if (response.execution.blockedTasks && response.execution.blockedTasks.length > 0) {
      feedback.push(`${response.execution.blockedTasks.length} tasks blocked.`);
    }

    return feedback.join(' ');
  }

  private getScenarios(complexity?: 'simple' | 'moderate' | 'complex') {
    const baseScenarios = [
      {
        category: 'user_authentication',
        input: {
          featureRequest: 'Add user authentication with email/password and social login',
          projectContext: 'Next.js application with TypeScript and PostgreSQL',
          constraints: ['Must be GDPR compliant', 'Support OAuth 2.0'],
          technologies: ['Next.js', 'TypeScript', 'PostgreSQL', 'NextAuth.js'],
        },
        expectedTaskCount: 6,
        expectedBehavior: [
          'Creates tasks for database schema',
          'Implements authentication endpoints',
          'Adds frontend components',
          'Includes security considerations',
          'Plans testing strategy',
        ],
      },
      {
        category: 'search_feature',
        input: {
          featureRequest: 'Implement full-text search with filters and autocomplete',
          projectContext: 'E-commerce platform with product catalog',
          constraints: ['Sub-100ms response time', 'Support 1M+ products'],
          technologies: ['Elasticsearch', 'React', 'Node.js'],
        },
        expectedTaskCount: 7,
        expectedBehavior: [
          'Sets up search infrastructure',
          'Implements indexing strategy',
          'Creates search API',
          'Builds UI components',
          'Adds caching layer',
          'Performance optimization tasks',
        ],
      },
      {
        category: 'notification_system',
        input: {
          featureRequest: 'Build real-time notification system with email and push notifications',
          projectContext: 'SaaS application for team collaboration',
          constraints: ['Scalable to 100K concurrent users', 'Delivery guarantees'],
          technologies: ['WebSockets', 'Redis', 'SendGrid', 'Firebase'],
        },
        expectedTaskCount: 8,
        expectedBehavior: [
          'Designs notification architecture',
          'Implements message queue',
          'Creates notification service',
          'Adds email integration',
          'Implements push notifications',
          'Builds preference management',
        ],
      },
    ];

    if (complexity === 'simple') {
      return baseScenarios.map((scenario) => ({
        ...scenario,
        input: {
          ...scenario.input,
          constraints: scenario.input.constraints.slice(0, 1),
          technologies: scenario.input.technologies.slice(0, 2),
        },
        expectedTaskCount: Math.max(3, scenario.expectedTaskCount - 2),
      }));
    } else if (complexity === 'complex') {
      return baseScenarios.map((scenario) => ({
        ...scenario,
        input: {
          ...scenario.input,
          constraints: [
            ...scenario.input.constraints,
            'Must support multiple regions',
            'Include monitoring and analytics',
            'Zero downtime deployment',
          ],
        },
        expectedTaskCount: scenario.expectedTaskCount + 3,
        expectedBehavior: [
          ...scenario.expectedBehavior,
          'Includes monitoring setup',
          'Plans rollback strategy',
          'Considers scalability',
        ],
      }));
    }

    return baseScenarios;
  }
}
