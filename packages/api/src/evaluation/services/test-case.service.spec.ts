import { Test, TestingModule } from '@nestjs/testing';
import { TestCaseService } from './test-case.service';
import { TestCase } from '../interfaces/evaluation.interface';
import { AgentPattern } from '../enums/agent-pattern.enum';

describe('TestCaseService', () => {
  let service: TestCaseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TestCaseService],
    }).compile();

    service = module.get<TestCaseService>(TestCaseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createTestCase', () => {
    it('should create a test case with generated ID', async () => {
      const testCaseData = {
        pattern: AgentPattern.SEQUENTIAL_PROCESSING,
        input: { prompt: 'Create marketing copy' },
        expectedOutput: { content: 'Expected output' },
        metadata: {
          difficulty: 'medium' as const,
          category: 'content-generation',
          tags: ['marketing', 'copy'],
        },
      };

      const result = await service.createTestCase(testCaseData);

      expect(result).toBeDefined();
      expect(result.id).toContain(AgentPattern.SEQUENTIAL_PROCESSING);
      expect(result.pattern).toBe(AgentPattern.SEQUENTIAL_PROCESSING);
      expect(result.input).toEqual(testCaseData.input);
      expect(result.metadata?.createdAt).toBeInstanceOf(Date);
      expect(result.metadata?.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('getTestCase', () => {
    it('should retrieve an existing test case', async () => {
      const created = await service.createTestCase({
        pattern: AgentPattern.ROUTING,
        input: { query: 'Test query' },
      });

      const retrieved = await service.getTestCase(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.pattern).toBe(AgentPattern.ROUTING);
    });

    it('should return null for non-existent test case', async () => {
      const result = await service.getTestCase('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('getTestCasesByPattern', () => {
    beforeEach(async () => {
      // Create test cases with different attributes
      await service.createTestCase({
        pattern: AgentPattern.PARALLEL_PROCESSING,
        input: { code: 'test1' },
        metadata: {
          difficulty: 'easy',
          category: 'concurrent-analysis',
          tags: ['performance'],
        },
      });

      await service.createTestCase({
        pattern: AgentPattern.PARALLEL_PROCESSING,
        input: { code: 'test2' },
        metadata: {
          difficulty: 'medium',
          category: 'concurrent-analysis',
          tags: ['security'],
        },
      });

      await service.createTestCase({
        pattern: AgentPattern.PARALLEL_PROCESSING,
        input: { code: 'test3' },
        metadata: {
          difficulty: 'hard',
          category: 'result-aggregation',
          tags: ['performance', 'security'],
        },
      });
    });

    it('should retrieve all test cases for a pattern', async () => {
      const results = await service.getTestCasesByPattern(AgentPattern.PARALLEL_PROCESSING);

      expect(results).toHaveLength(3);
      expect(results.every((tc) => tc.pattern === AgentPattern.PARALLEL_PROCESSING)).toBe(true);
    });

    it('should filter by difficulty', async () => {
      const results = await service.getTestCasesByPattern(AgentPattern.PARALLEL_PROCESSING, {
        difficulty: 'easy',
      });

      expect(results).toHaveLength(1);
      expect(results[0].metadata?.difficulty).toBe('easy');
    });

    it('should filter by category', async () => {
      const results = await service.getTestCasesByPattern(AgentPattern.PARALLEL_PROCESSING, {
        category: 'concurrent-analysis',
      });

      expect(results).toHaveLength(2);
      expect(results.every((tc) => tc.metadata?.category === 'concurrent-analysis')).toBe(true);
    });

    it('should filter by tags', async () => {
      const results = await service.getTestCasesByPattern(AgentPattern.PARALLEL_PROCESSING, {
        tags: ['security'],
      });

      expect(results).toHaveLength(2);
      expect(results.every((tc) => tc.metadata?.tags?.includes('security'))).toBe(true);
    });

    it('should apply limit', async () => {
      const results = await service.getTestCasesByPattern(AgentPattern.PARALLEL_PROCESSING, {
        limit: 2,
      });

      expect(results).toHaveLength(2);
    });

    it('should support random sampling', async () => {
      const results1 = await service.getTestCasesByPattern(AgentPattern.PARALLEL_PROCESSING, {
        random: true,
        limit: 2,
      });

      const results2 = await service.getTestCasesByPattern(AgentPattern.PARALLEL_PROCESSING, {
        random: true,
        limit: 2,
      });

      // With only 3 test cases, random sampling might produce same results
      // but the implementation should work
      expect(results1).toHaveLength(2);
      expect(results2).toHaveLength(2);
    });
  });

  describe('updateTestCase', () => {
    it('should update an existing test case', async () => {
      const created = await service.createTestCase({
        pattern: AgentPattern.EVALUATOR_OPTIMIZER,
        input: { text: 'Original' },
      });

      const originalUpdatedAt = created.metadata?.updatedAt;

      // Wait a bit to ensure updatedAt changes
      await new Promise((resolve) => setTimeout(resolve, 10));

      const updated = await service.updateTestCase(created.id, {
        input: { text: 'Updated' },
        metadata: {
          difficulty: 'hard',
        },
      });

      expect(updated).toBeDefined();
      expect(updated?.input).toEqual({ text: 'Updated' });
      expect(updated?.metadata?.difficulty).toBe('hard');
      expect(updated?.metadata?.updatedAt).not.toEqual(originalUpdatedAt);
    });

    it('should return null for non-existent test case', async () => {
      const result = await service.updateTestCase('non-existent', {
        input: { test: 'data' },
      });

      expect(result).toBeNull();
    });
  });

  describe('deleteTestCase', () => {
    it('should delete an existing test case', async () => {
      const created = await service.createTestCase({
        pattern: AgentPattern.MULTI_STEP_TOOL_USAGE,
        input: { problem: 'Test' },
      });

      const deleted = await service.deleteTestCase(created.id);
      expect(deleted).toBe(true);

      const retrieved = await service.getTestCase(created.id);
      expect(retrieved).toBeNull();
    });

    it('should return false for non-existent test case', async () => {
      const result = await service.deleteTestCase('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('getCoverageAnalysis', () => {
    beforeEach(async () => {
      // Create diverse test cases
      for (let i = 0; i < 5; i++) {
        await service.createTestCase({
          pattern: AgentPattern.ORCHESTRATOR_WORKER,
          input: { task: `Task ${i}` },
          metadata: {
            difficulty: i < 2 ? 'easy' : i < 4 ? 'medium' : 'hard',
            category: i % 2 === 0 ? 'task-decomposition' : 'worker-coordination',
            tags: [`tag${i}`, 'common'],
          },
        });
      }
    });

    it('should analyze test coverage', async () => {
      const analysis = await service.getCoverageAnalysis(AgentPattern.ORCHESTRATOR_WORKER);

      expect(analysis.totalTestCases).toBe(5);
      expect(analysis.byDifficulty).toEqual({
        easy: 2,
        medium: 2,
        hard: 1,
      });
      expect(analysis.byCategory).toEqual({
        'task-decomposition': 3,
        'worker-coordination': 2,
      });
      expect(analysis.byTags['common']).toBe(5);
      expect(analysis.coverageGaps).toHaveLength(2); // Less than 10 test cases and limited categories
    });

    it('should identify coverage gaps', async () => {
      // Create pattern with no test cases
      const analysis = await service.getCoverageAnalysis(AgentPattern.SEQUENTIAL_PROCESSING);

      expect(analysis.totalTestCases).toBe(0);
      expect(analysis.coverageGaps).toContain('No easy difficulty test cases');
      expect(analysis.coverageGaps).toContain('No medium difficulty test cases');
      expect(analysis.coverageGaps).toContain('No hard difficulty test cases');
    });
  });

  describe('generateTestCaseSuggestions', () => {
    it('should suggest missing difficulties', async () => {
      // Create only easy test cases
      await service.createTestCase({
        pattern: AgentPattern.ROUTING,
        input: { query: 'Test' },
        metadata: { difficulty: 'easy' },
      });

      const suggestions = await service.generateTestCaseSuggestions(AgentPattern.ROUTING, []);

      expect(suggestions.suggestedDifficulties).toContain('medium');
      expect(suggestions.suggestedDifficulties).toContain('hard');
      expect(suggestions.suggestedDifficulties).not.toContain('easy');
    });

    it('should suggest pattern-specific categories', async () => {
      const suggestions = await service.generateTestCaseSuggestions(AgentPattern.ROUTING, []);

      expect(suggestions.suggestedCategories).toContain('query-classification');
      expect(suggestions.suggestedCategories).toContain('response-routing');
      expect(suggestions.suggestedCategories).toContain('specialist-handling');
    });

    it('should provide scenario suggestions', async () => {
      const suggestions = await service.generateTestCaseSuggestions(
        AgentPattern.MULTI_STEP_TOOL_USAGE,
        [],
      );

      expect(suggestions.suggestedScenarios).toBeInstanceOf(Array);
      expect(suggestions.suggestedScenarios.length).toBeGreaterThan(0);
      expect(suggestions.suggestedScenarios.some((s) => s.includes('mathematical'))).toBe(true);
    });
  });
});
