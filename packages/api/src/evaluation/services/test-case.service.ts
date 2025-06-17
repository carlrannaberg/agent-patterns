import { Injectable, Logger } from '@nestjs/common';
import { TestCase } from '../interfaces/evaluation.interface';
import { AgentPattern } from '../enums/agent-pattern.enum';

@Injectable()
export class TestCaseService {
  private readonly logger = new Logger(TestCaseService.name);
  private testCases: Map<string, TestCase> = new Map();
  private testCasesByPattern: Map<AgentPattern, Set<string>> = new Map();

  constructor() {
    // Initialize pattern maps
    Object.values(AgentPattern).forEach((pattern) => {
      this.testCasesByPattern.set(pattern, new Set());
    });
  }

  async createTestCase(testCase: Omit<TestCase, 'id'>): Promise<TestCase> {
    const id = this.generateTestCaseId(testCase.pattern);
    const newTestCase: TestCase = {
      ...testCase,
      id,
      metadata: {
        ...testCase.metadata,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    this.testCases.set(id, newTestCase);
    this.testCasesByPattern.get(testCase.pattern)?.add(id);

    this.logger.log(`Created test case ${id} for pattern ${testCase.pattern}`);
    return newTestCase;
  }

  async getTestCase(id: string): Promise<TestCase | null> {
    return this.testCases.get(id) || null;
  }

  async getTestCasesByPattern(
    pattern: AgentPattern,
    options?: {
      difficulty?: 'easy' | 'medium' | 'hard';
      category?: string;
      tags?: string[];
      limit?: number;
      random?: boolean;
    },
  ): Promise<TestCase[]> {
    const patternTestCaseIds = this.testCasesByPattern.get(pattern) || new Set();
    let testCases = Array.from(patternTestCaseIds)
      .map((id) => this.testCases.get(id))
      .filter((tc): tc is TestCase => tc !== undefined);

    // Apply filters
    if (options?.difficulty) {
      testCases = testCases.filter((tc) => tc.metadata?.difficulty === options.difficulty);
    }

    if (options?.category) {
      testCases = testCases.filter((tc) => tc.metadata?.category === options.category);
    }

    if (options?.tags && options.tags.length > 0) {
      testCases = testCases.filter((tc) =>
        options.tags!.some((tag) => tc.metadata?.tags?.includes(tag)),
      );
    }

    // Random selection
    if (options?.random && options?.limit) {
      testCases = this.randomSample(testCases, options.limit);
    } else if (options?.limit) {
      testCases = testCases.slice(0, options.limit);
    }

    return testCases;
  }

  async updateTestCase(
    id: string,
    updates: Partial<Omit<TestCase, 'id' | 'pattern'>>,
  ): Promise<TestCase | null> {
    const existingTestCase = this.testCases.get(id);
    if (!existingTestCase) {
      return null;
    }

    const updatedTestCase: TestCase = {
      ...existingTestCase,
      ...updates,
      metadata: {
        ...existingTestCase.metadata,
        ...updates.metadata,
        updatedAt: new Date(),
      },
    };

    this.testCases.set(id, updatedTestCase);
    this.logger.log(`Updated test case ${id}`);
    return updatedTestCase;
  }

  async deleteTestCase(id: string): Promise<boolean> {
    const testCase = this.testCases.get(id);
    if (!testCase) {
      return false;
    }

    this.testCases.delete(id);
    this.testCasesByPattern.get(testCase.pattern)?.delete(id);
    this.logger.log(`Deleted test case ${id}`);
    return true;
  }

  async getCoverageAnalysis(pattern: AgentPattern): Promise<{
    totalTestCases: number;
    byDifficulty: Record<string, number>;
    byCategory: Record<string, number>;
    byTags: Record<string, number>;
    coverageGaps: string[];
  }> {
    const testCases = await this.getTestCasesByPattern(pattern);

    const byDifficulty: Record<string, number> = {
      easy: 0,
      medium: 0,
      hard: 0,
    };

    const byCategory: Record<string, number> = {};
    const byTags: Record<string, number> = {};

    testCases.forEach((tc) => {
      if (tc.metadata?.difficulty) {
        byDifficulty[tc.metadata.difficulty]++;
      }

      if (tc.metadata?.category) {
        byCategory[tc.metadata.category] = (byCategory[tc.metadata.category] || 0) + 1;
      }

      tc.metadata?.tags?.forEach((tag) => {
        byTags[tag] = (byTags[tag] || 0) + 1;
      });
    });

    // Identify coverage gaps
    const coverageGaps: string[] = [];

    // Check difficulty distribution
    const difficulties = Object.keys(byDifficulty);
    difficulties.forEach((diff) => {
      if (byDifficulty[diff] === 0) {
        coverageGaps.push(`No ${diff} difficulty test cases`);
      }
    });

    // Check for minimum test case count
    if (testCases.length < 10) {
      coverageGaps.push(`Only ${testCases.length} test cases (recommend at least 10)`);
    }

    // Check for category diversity
    if (Object.keys(byCategory).length < 3) {
      coverageGaps.push(
        `Limited category diversity (${Object.keys(byCategory).length} categories)`,
      );
    }

    return {
      totalTestCases: testCases.length,
      byDifficulty,
      byCategory,
      byTags,
      coverageGaps,
    };
  }

  async generateTestCaseSuggestions(
    pattern: AgentPattern,
    existingTestCases: TestCase[],
  ): Promise<{
    suggestedCategories: string[];
    suggestedDifficulties: Array<'easy' | 'medium' | 'hard'>;
    suggestedScenarios: string[];
  }> {
    const coverage = await this.getCoverageAnalysis(pattern);

    // Suggest missing difficulties
    const suggestedDifficulties: Array<'easy' | 'medium' | 'hard'> = [];
    (['easy', 'medium', 'hard'] as const).forEach((diff) => {
      if (coverage.byDifficulty[diff] === 0) {
        suggestedDifficulties.push(diff);
      }
    });

    // Suggest new categories based on pattern
    const suggestedCategories = this.getPatternSpecificCategories(pattern).filter(
      (cat) => !coverage.byCategory[cat],
    );

    // Generate scenario suggestions based on pattern
    const suggestedScenarios = this.generatePatternSpecificScenarios(pattern);

    return {
      suggestedCategories,
      suggestedDifficulties,
      suggestedScenarios,
    };
  }

  private generateTestCaseId(pattern: AgentPattern): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${pattern}-${timestamp}-${random}`;
  }

  private randomSample<T>(array: T[], sampleSize: number): T[] {
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, sampleSize);
  }

  private getPatternSpecificCategories(pattern: AgentPattern): string[] {
    const categoryMap: Record<AgentPattern, string[]> = {
      [AgentPattern.SEQUENTIAL_PROCESSING]: [
        'content-generation',
        'quality-evaluation',
        'iterative-improvement',
      ],
      [AgentPattern.ROUTING]: ['query-classification', 'response-routing', 'specialist-handling'],
      [AgentPattern.PARALLEL_PROCESSING]: [
        'concurrent-analysis',
        'result-aggregation',
        'performance-optimization',
      ],
      [AgentPattern.ORCHESTRATOR_WORKER]: [
        'task-decomposition',
        'worker-coordination',
        'result-synthesis',
      ],
      [AgentPattern.EVALUATOR_OPTIMIZER]: [
        'quality-assessment',
        'iterative-refinement',
        'feedback-integration',
      ],
      [AgentPattern.MULTI_STEP_TOOL_USAGE]: [
        'tool-selection',
        'step-execution',
        'result-integration',
      ],
    };

    return categoryMap[pattern] || [];
  }

  private generatePatternSpecificScenarios(pattern: AgentPattern): string[] {
    const scenarioMap: Record<AgentPattern, string[]> = {
      [AgentPattern.SEQUENTIAL_PROCESSING]: [
        'Generate marketing copy with specific tone requirements',
        'Create content that fails initial quality check',
        'Handle edge cases with conflicting requirements',
      ],
      [AgentPattern.ROUTING]: [
        'Route technical queries to appropriate specialists',
        'Handle ambiguous queries requiring multiple specialists',
        'Process queries with missing context information',
      ],
      [AgentPattern.PARALLEL_PROCESSING]: [
        'Analyze code with multiple quality dimensions',
        'Handle timeout scenarios in parallel processing',
        'Process inputs with varying complexity levels',
      ],
      [AgentPattern.ORCHESTRATOR_WORKER]: [
        'Decompose complex features into subtasks',
        'Handle worker failures and recovery',
        'Coordinate dependencies between workers',
      ],
      [AgentPattern.EVALUATOR_OPTIMIZER]: [
        'Optimize translations with cultural nuances',
        'Handle evaluation feedback loops',
        'Process content with domain-specific terminology',
      ],
      [AgentPattern.MULTI_STEP_TOOL_USAGE]: [
        'Solve multi-step mathematical problems',
        'Handle tool execution failures',
        'Process problems requiring tool chaining',
      ],
    };

    return scenarioMap[pattern] || [];
  }
}
