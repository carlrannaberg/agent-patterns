import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { TestSuite, TestCase, TestSuiteConfig } from '../interfaces/runner.interface';
import { AgentPattern } from '../../enums/agent-pattern.enum';
import { TestCaseService } from '../../services/test-case.service';

@Injectable()
export class TestSuiteService {
  private readonly suites = new Map<string, TestSuite>();

  constructor(private readonly testCaseService: TestCaseService) {
    this.initializeDefaultSuites();
  }

  async getSuite(suiteId: string): Promise<TestSuite> {
    const suite = this.suites.get(suiteId);
    if (!suite) {
      throw new Error(`Test suite ${suiteId} not found`);
    }
    return suite;
  }

  async getAllSuites(): Promise<TestSuite[]> {
    return Array.from(this.suites.values());
  }

  async createSuite(suite: Partial<TestSuite>): Promise<TestSuite> {
    const newSuite: TestSuite = {
      id: suite.id || uuidv4(),
      name: suite.name || 'Unnamed Suite',
      description: suite.description || '',
      patterns: suite.patterns || [],
      testCases: suite.testCases || [],
      config: suite.config || this.getDefaultConfig(),
      enabled: suite.enabled !== false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.suites.set(newSuite.id, newSuite);
    return newSuite;
  }

  async updateSuite(suiteId: string, updates: Partial<TestSuite>): Promise<TestSuite> {
    const suite = await this.getSuite(suiteId);
    const updatedSuite = {
      ...suite,
      ...updates,
      updatedAt: new Date(),
    };
    this.suites.set(suiteId, updatedSuite);
    return updatedSuite;
  }

  async deleteSuite(suiteId: string): Promise<void> {
    this.suites.delete(suiteId);
  }

  async createDefaultSuite(patterns: AgentPattern[]): Promise<TestSuite> {
    const testCases = await this.generateDefaultTestCases(patterns);

    return this.createSuite({
      name: 'Ad-hoc Test Suite',
      description: 'Automatically generated test suite',
      patterns,
      testCases,
      config: this.getDefaultConfig(),
    });
  }

  private async generateDefaultTestCases(patterns: AgentPattern[]): Promise<TestCase[]> {
    const testCases: TestCase[] = [];

    for (const pattern of patterns) {
      const patternTestCases = await this.testCaseService.getTestCasesForPattern(pattern);
      testCases.push(
        ...patternTestCases.map((tc) => ({
          id: uuidv4(),
          pattern,
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          metadata: tc.metadata,
          timeout: 30000,
        })),
      );
    }

    return testCases;
  }

  private getDefaultConfig(): TestSuiteConfig {
    return {
      parallel: true,
      maxConcurrency: 5,
      retryAttempts: 2,
      retryDelay: 1000,
      timeout: 60000,
      rateLimit: {
        maxRequestsPerMinute: 60,
        maxTokensPerMinute: 100000,
      },
      cache: {
        enabled: true,
        ttl: 3600,
      },
    };
  }

  private initializeDefaultSuites(): void {
    const comprehensiveSuite: TestSuite = {
      id: 'comprehensive',
      name: 'Comprehensive Evaluation Suite',
      description: 'Full evaluation of all agent patterns',
      patterns: Object.values(AgentPattern),
      testCases: [],
      config: this.getDefaultConfig(),
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const quickSuite: TestSuite = {
      id: 'quick',
      name: 'Quick Smoke Test Suite',
      description: 'Fast validation of core functionality',
      patterns: Object.values(AgentPattern),
      testCases: [],
      config: {
        ...this.getDefaultConfig(),
        maxConcurrency: 10,
        retryAttempts: 0,
      },
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const regressionSuite: TestSuite = {
      id: 'regression',
      name: 'Regression Test Suite',
      description: 'Regression testing for all patterns',
      patterns: Object.values(AgentPattern),
      testCases: [],
      config: {
        ...this.getDefaultConfig(),
        parallel: false,
        retryAttempts: 3,
      },
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.suites.set(comprehensiveSuite.id, comprehensiveSuite);
    this.suites.set(quickSuite.id, quickSuite);
    this.suites.set(regressionSuite.id, regressionSuite);
  }
}
