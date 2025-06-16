import { Test, TestingModule } from '@nestjs/testing';
import { OrchestratorWorkerService } from './orchestrator-worker.service';
import { generateObject, streamObject } from 'ai';
import { Readable } from 'stream';

// Mock the AI SDK
jest.mock('ai');
jest.mock('@ai-sdk/google');

const mockGenerateObject = generateObject as jest.MockedFunction<typeof generateObject>;
const mockStreamObject = streamObject as jest.MockedFunction<typeof streamObject>;

describe('OrchestratorWorkerService - Business Logic', () => {
  let service: OrchestratorWorkerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OrchestratorWorkerService],
    }).compile();

    service = module.get<OrchestratorWorkerService>(OrchestratorWorkerService);
    
    // Reset mocks before each test
    jest.clearAllMocks();
  });

  describe('Orchestrator Planning Phase', () => {
    it('should create implementation plan for simple feature request', async () => {
      // Arrange: Mock orchestrator response for simple feature
      const implementationPlan = {
        files: [
          {
            purpose: 'Add user authentication endpoint',
            filePath: 'src/auth/auth.controller.ts',
            changeType: 'create' as const,
          },
        ],
        estimatedComplexity: 'low' as const,
      };

      mockGenerateObject
        .mockResolvedValueOnce({ object: implementationPlan } as any)
        .mockResolvedValueOnce({
          object: {
            explanation: 'Create authentication controller with login endpoint',
            code: 'export class AuthController { login() { /* implementation */ } }',
          },
        } as any);

      mockStreamObject.mockReturnValue({
        toTextStreamResponse: jest.fn().mockReturnValue(new Readable({ read() {} })),
      } as any);

      // Act
      await service.implementFeature('Add user login functionality');

      // Assert: Orchestrator should be called for planning
      expect(mockGenerateObject).toHaveBeenNthCalledWith(1,
        expect.objectContaining({
          system: expect.stringContaining('senior software architect planning feature implementations'),
          prompt: expect.stringContaining('Add user login functionality'),
        })
      );
    });

    it('should create implementation plan for complex feature request', async () => {
      // Arrange: Mock orchestrator response for complex feature
      const implementationPlan = {
        files: [
          {
            purpose: 'User model with authentication fields',
            filePath: 'src/models/user.model.ts',
            changeType: 'create' as const,
          },
          {
            purpose: 'Authentication service with JWT handling',
            filePath: 'src/auth/auth.service.ts',
            changeType: 'create' as const,
          },
          {
            purpose: 'Authentication controller endpoints',
            filePath: 'src/auth/auth.controller.ts',
            changeType: 'create' as const,
          },
          {
            purpose: 'Update main module to include auth',
            filePath: 'src/app.module.ts',
            changeType: 'modify' as const,
          },
        ],
        estimatedComplexity: 'high' as const,
      };

      mockGenerateObject
        .mockResolvedValueOnce({ object: implementationPlan } as any)
        .mockResolvedValue({
          object: {
            explanation: 'Implementation details',
            code: 'Code implementation',
          },
        } as any);

      mockStreamObject.mockReturnValue({
        toTextStreamResponse: jest.fn().mockReturnValue(new Readable({ read() {} })),
      } as any);

      // Act
      await service.implementFeature('Build complete authentication system with JWT, password hashing, and role-based access control');

      // Assert: Should identify high complexity and multiple files
      expect(mockGenerateObject).toHaveBeenCalledTimes(5); // 1 orchestrator + 4 workers
      
      // Verify orchestrator call
      const orchestratorCall = mockGenerateObject.mock.calls[0][0];
      expect(orchestratorCall.system).toContain('senior software architect');
      expect(orchestratorCall.prompt).toContain('complete authentication system');
    });

    it('should handle different change types correctly', async () => {
      // Arrange: Mock plan with all change types
      const implementationPlan = {
        files: [
          {
            purpose: 'Create new feature component',
            filePath: 'src/components/new-feature.tsx',
            changeType: 'create' as const,
          },
          {
            purpose: 'Update existing service',
            filePath: 'src/services/existing.service.ts',
            changeType: 'modify' as const,
          },
          {
            purpose: 'Remove deprecated utility',
            filePath: 'src/utils/deprecated.util.ts',
            changeType: 'delete' as const,
          },
        ],
        estimatedComplexity: 'medium' as const,
      };

      mockGenerateObject
        .mockResolvedValueOnce({ object: implementationPlan } as any)
        .mockResolvedValue({
          object: {
            explanation: 'Implementation',
            code: 'Code',
          },
        } as any);

      mockStreamObject.mockReturnValue({
        toTextStreamResponse: jest.fn().mockReturnValue(new Readable({ read() {} })),
      } as any);

      // Act
      await service.implementFeature('Refactor feature with new component');

      // Assert: Should call worker for each file with appropriate system prompt
      expect(mockGenerateObject).toHaveBeenCalledTimes(4); // 1 orchestrator + 3 workers
      
      // Verify create worker prompt
      expect(mockGenerateObject).toHaveBeenNthCalledWith(2,
        expect.objectContaining({
          system: expect.stringContaining('creating new files'),
        })
      );
      
      // Verify modify worker prompt
      expect(mockGenerateObject).toHaveBeenNthCalledWith(3,
        expect.objectContaining({
          system: expect.stringContaining('modifying existing files'),
        })
      );
      
      // Verify delete worker prompt
      expect(mockGenerateObject).toHaveBeenNthCalledWith(4,
        expect.objectContaining({
          system: expect.stringContaining('removing files'),
        })
      );
    });
  });

  describe('Worker Implementation Phase', () => {
    it('should implement all planned files in parallel', async () => {
      // Arrange: Mock plan with multiple files
      const implementationPlan = {
        files: [
          {
            purpose: 'API endpoint',
            filePath: 'src/api/endpoint.ts',
            changeType: 'create' as const,
          },
          {
            purpose: 'Database model',
            filePath: 'src/models/model.ts',
            changeType: 'create' as const,
          },
        ],
        estimatedComplexity: 'medium' as const,
      };

      let worker1Called = false;
      let worker2Called = false;

      mockGenerateObject
        .mockResolvedValueOnce({ object: implementationPlan } as any)
        .mockImplementationOnce(async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          worker1Called = true;
          return {
            object: {
              explanation: 'API endpoint implementation',
              code: 'export class ApiEndpoint {}',
            },
          } as any;
        })
        .mockImplementationOnce(async () => {
          await new Promise(resolve => setTimeout(resolve, 20));
          worker2Called = true;
          return {
            object: {
              explanation: 'Database model implementation',
              code: 'export class DatabaseModel {}',
            },
          } as any;
        });

      mockStreamObject.mockReturnValue({
        toTextStreamResponse: jest.fn().mockReturnValue(new Readable({ read() {} })),
      } as any);

      // Act
      await service.implementFeature('Create API with database');

      // Assert: Both workers should have been called
      expect(worker1Called).toBe(true);
      expect(worker2Called).toBe(true);
      expect(mockGenerateObject).toHaveBeenCalledTimes(3); // 1 orchestrator + 2 workers
    });

    it('should provide proper context to workers', async () => {
      // Arrange: Mock implementation plan
      const implementationPlan = {
        files: [
          {
            purpose: 'User registration validation',
            filePath: 'src/validators/user.validator.ts',
            changeType: 'create' as const,
          },
        ],
        estimatedComplexity: 'low' as const,
      };

      mockGenerateObject
        .mockResolvedValueOnce({ object: implementationPlan } as any)
        .mockResolvedValueOnce({
          object: {
            explanation: 'User validation implementation',
            code: 'export const validateUser = () => {}',
          },
        } as any);

      mockStreamObject.mockReturnValue({
        toTextStreamResponse: jest.fn().mockReturnValue(new Readable({ read() {} })),
      } as any);

      // Act
      await service.implementFeature('Add user registration with email validation');

      // Assert: Worker should receive file context and overall feature context
      const workerCall = mockGenerateObject.mock.calls[1][0];
      expect(workerCall.prompt).toContain('User registration validation');
      expect(workerCall.prompt).toContain('src/validators/user.validator.ts');
      expect(workerCall.prompt).toContain('Add user registration with email validation');
    });

    it('should use appropriate worker system prompts for each change type', async () => {
      // Test each change type individually
      const testCases = [
        {
          changeType: 'create' as const,
          expectedSystemPrompt: 'creating new files',
        },
        {
          changeType: 'modify' as const,
          expectedSystemPrompt: 'modifying existing files',
        },
        {
          changeType: 'delete' as const,
          expectedSystemPrompt: 'removing files',
        },
      ];

      for (const testCase of testCases) {
        jest.clearAllMocks();

        const implementationPlan = {
          files: [
            {
              purpose: 'Test file',
              filePath: 'src/test.ts',
              changeType: testCase.changeType,
            },
          ],
          estimatedComplexity: 'low' as const,
        };

        mockGenerateObject
          .mockResolvedValueOnce({ object: implementationPlan } as any)
          .mockResolvedValueOnce({
            object: {
              explanation: 'Test implementation',
              code: 'test code',
            },
          } as any);

        mockStreamObject.mockReturnValue({
          toTextStreamResponse: jest.fn().mockReturnValue(new Readable({ read() {} })),
        } as any);

        await service.implementFeature(`Test ${testCase.changeType} operation`);

        const workerCall = mockGenerateObject.mock.calls[1][0];
        expect(workerCall.system).toContain(testCase.expectedSystemPrompt);
      }
    });
  });

  describe('Streaming Response Generation', () => {
    it('should generate proper streaming response with plan and changes', async () => {
      // Arrange: Mock complete implementation cycle
      const implementationPlan = {
        files: [
          {
            purpose: 'Main component',
            filePath: 'src/components/main.tsx',
            changeType: 'create' as const,
          },
        ],
        estimatedComplexity: 'medium' as const,
      };

      const workerImplementation = {
        explanation: 'Creates the main component with proper props',
        code: 'export const MainComponent = () => <div>Main</div>',
      };

      mockGenerateObject
        .mockResolvedValueOnce({ object: implementationPlan } as any)
        .mockResolvedValueOnce({ object: workerImplementation } as any);

      const mockStream = new Readable({ read() {} });
      mockStreamObject.mockReturnValue({
        toTextStreamResponse: jest.fn().mockReturnValue(mockStream),
      } as any);

      // Act
      const result = await service.implementFeature('Create main component');

      // Assert: Verify streaming response structure
      expect(mockStreamObject).toHaveBeenCalledWith({
        model: expect.any(Object),
        schema: expect.objectContaining({
          shape: expect.objectContaining({
            plan: expect.any(Object),
            changes: expect.any(Object),
          }),
        }),
        prompt: expect.stringContaining('Return the following data as a structured object'),
      });

      // Verify plan and changes data is included
      const streamCall = mockStreamObject.mock.calls[0][0];
      expect(streamCall.prompt).toContain('Main component');
      expect(streamCall.prompt).toContain('src/components/main.tsx');
      expect(streamCall.prompt).toContain('Creates the main component with proper props');

      expect(result).toBe(mockStream);
    });

    it('should include all file changes in response', async () => {
      // Arrange: Mock multiple file implementation
      const implementationPlan = {
        files: [
          {
            purpose: 'Service layer',
            filePath: 'src/services/feature.service.ts',
            changeType: 'create' as const,
          },
          {
            purpose: 'Controller layer',
            filePath: 'src/controllers/feature.controller.ts',
            changeType: 'create' as const,
          },
        ],
        estimatedComplexity: 'high' as const,
      };

      mockGenerateObject
        .mockResolvedValueOnce({ object: implementationPlan } as any)
        .mockResolvedValueOnce({
          object: {
            explanation: 'Service implementation',
            code: 'export class FeatureService {}',
          },
        } as any)
        .mockResolvedValueOnce({
          object: {
            explanation: 'Controller implementation',
            code: 'export class FeatureController {}',
          },
        } as any);

      mockStreamObject.mockReturnValue({
        toTextStreamResponse: jest.fn().mockReturnValue(new Readable({ read() {} })),
      } as any);

      // Act
      await service.implementFeature('Create feature with service and controller');

      // Assert: All implementations should be included in streaming response
      const streamCall = mockStreamObject.mock.calls[0][0];
      expect(streamCall.prompt).toContain('Service layer');
      expect(streamCall.prompt).toContain('Controller layer');
      expect(streamCall.prompt).toContain('Service implementation');
      expect(streamCall.prompt).toContain('Controller implementation');
    });
  });

  describe('Error Handling', () => {
    it('should handle orchestrator planning failures gracefully', async () => {
      // Arrange: Mock orchestrator failure
      mockGenerateObject.mockRejectedValueOnce(new Error('Planning API Error'));

      // Act & Assert: Should throw the error
      await expect(
        service.implementFeature('test feature')
      ).rejects.toThrow('Planning API Error');
    });

    it('should handle individual worker failures gracefully', async () => {
      // Arrange: Orchestrator succeeds but worker fails
      const implementationPlan = {
        files: [
          {
            purpose: 'Test file',
            filePath: 'src/test.ts',
            changeType: 'create' as const,
          },
        ],
        estimatedComplexity: 'low' as const,
      };

      mockGenerateObject
        .mockResolvedValueOnce({ object: implementationPlan } as any)
        .mockRejectedValueOnce(new Error('Worker API Error'));

      // Act & Assert: Should throw worker error (Promise.all will reject)
      await expect(
        service.implementFeature('test feature')
      ).rejects.toThrow('Worker API Error');
    });

    it('should handle multiple worker failures gracefully', async () => {
      // Arrange: Orchestrator succeeds but multiple workers fail
      const implementationPlan = {
        files: [
          {
            purpose: 'First file',
            filePath: 'src/first.ts',
            changeType: 'create' as const,
          },
          {
            purpose: 'Second file',
            filePath: 'src/second.ts',
            changeType: 'create' as const,
          },
        ],
        estimatedComplexity: 'medium' as const,
      };

      mockGenerateObject
        .mockResolvedValueOnce({ object: implementationPlan } as any)
        .mockRejectedValueOnce(new Error('First Worker Error'))
        .mockRejectedValueOnce(new Error('Second Worker Error'));

      // Act & Assert: Should throw first error that rejects (Promise.all behavior)
      await expect(
        service.implementFeature('test feature')
      ).rejects.toThrow(/Worker Error/);
    });

    it('should handle streaming response failures gracefully', async () => {
      // Arrange: All AI calls succeed but streaming fails
      const implementationPlan = {
        files: [
          {
            purpose: 'Test file',
            filePath: 'src/test.ts',
            changeType: 'create' as const,
          },
        ],
        estimatedComplexity: 'low' as const,
      };

      mockGenerateObject
        .mockResolvedValueOnce({ object: implementationPlan } as any)
        .mockResolvedValueOnce({
          object: {
            explanation: 'Test implementation',
            code: 'test code',
          },
        } as any);

      mockStreamObject.mockImplementation(() => {
        throw new Error('Streaming Error');
      });

      // Act & Assert: Should throw streaming error
      await expect(
        service.implementFeature('test feature')
      ).rejects.toThrow('Streaming Error');
    });
  });

  describe('Business Rule Validation', () => {
    it('should enforce complexity level constraints', async () => {
      // Test valid complexity levels
      const validComplexities = ['low', 'medium', 'high'] as const;

      for (const complexity of validComplexities) {
        jest.clearAllMocks();

        const implementationPlan = {
          files: [
            {
              purpose: 'Test file',
              filePath: 'src/test.ts',
              changeType: 'create' as const,
            },
          ],
          estimatedComplexity: complexity,
        };

        mockGenerateObject
          .mockResolvedValueOnce({ object: implementationPlan } as any)
          .mockResolvedValueOnce({
            object: {
              explanation: 'Test implementation',
              code: 'test code',
            },
          } as any);

        mockStreamObject.mockReturnValue({
          toTextStreamResponse: jest.fn().mockReturnValue(new Readable({ read() {} })),
        } as any);

        // Should not throw for valid complexity levels
        await expect(
          service.implementFeature(`test feature with ${complexity} complexity`)
        ).resolves.toBeDefined();
      }
    });

    it('should enforce change type constraints', async () => {
      // Test valid change types
      const validChangeTypes = ['create', 'modify', 'delete'] as const;

      for (const changeType of validChangeTypes) {
        jest.clearAllMocks();

        const implementationPlan = {
          files: [
            {
              purpose: 'Test file',
              filePath: 'src/test.ts',
              changeType,
            },
          ],
          estimatedComplexity: 'low' as const,
        };

        mockGenerateObject
          .mockResolvedValueOnce({ object: implementationPlan } as any)
          .mockResolvedValueOnce({
            object: {
              explanation: 'Test implementation',
              code: 'test code',
            },
          } as any);

        mockStreamObject.mockReturnValue({
          toTextStreamResponse: jest.fn().mockReturnValue(new Readable({ read() {} })),
        } as any);

        // Should not throw for valid change types
        await expect(
          service.implementFeature(`test feature with ${changeType} operation`)
        ).resolves.toBeDefined();
      }
    });

    it('should ensure workers receive complete context', async () => {
      // Arrange: Mock implementation plan
      const featureRequest = 'Build user management system';
      const implementationPlan = {
        files: [
          {
            purpose: 'User model with validation',
            filePath: 'src/models/user.model.ts',
            changeType: 'create' as const,
          },
        ],
        estimatedComplexity: 'medium' as const,
      };

      mockGenerateObject
        .mockResolvedValueOnce({ object: implementationPlan } as any)
        .mockResolvedValueOnce({
          object: {
            explanation: 'User model implementation',
            code: 'export class User {}',
          },
        } as any);

      mockStreamObject.mockReturnValue({
        toTextStreamResponse: jest.fn().mockReturnValue(new Readable({ read() {} })),
      } as any);

      // Act
      await service.implementFeature(featureRequest);

      // Assert: Worker should receive both file-specific and feature-wide context
      const workerCall = mockGenerateObject.mock.calls[1][0];
      expect(workerCall.prompt).toContain('src/models/user.model.ts');
      expect(workerCall.prompt).toContain('User model with validation');
      expect(workerCall.prompt).toContain('Build user management system');
    });

    it('should handle orchestrator-worker coordination correctly', async () => {
      // Arrange: Mock orchestrator planning phase
      const implementationPlan = {
        files: [
          {
            purpose: 'Authentication middleware',
            filePath: 'src/middleware/auth.middleware.ts',
            changeType: 'create' as const,
          },
        ],
        estimatedComplexity: 'medium' as const,
      };

      mockGenerateObject
        .mockResolvedValueOnce({ object: implementationPlan } as any)
        .mockResolvedValueOnce({
          object: {
            explanation: 'Middleware that validates JWT tokens',
            code: 'export const authMiddleware = () => {}',
          },
        } as any);

      mockStreamObject.mockReturnValue({
        toTextStreamResponse: jest.fn().mockReturnValue(new Readable({ read() {} })),
      } as any);

      // Act
      await service.implementFeature('Add authentication middleware');

      // Assert: Verify orchestrator-worker handoff
      expect(mockGenerateObject).toHaveBeenCalledTimes(2);
      
      // Orchestrator call should be for planning
      const orchestratorCall = mockGenerateObject.mock.calls[0][0];
      expect(orchestratorCall.system).toContain('senior software architect');
      expect(orchestratorCall.prompt).toContain('create an implementation plan');
      
      // Worker call should be for implementation
      const workerCall = mockGenerateObject.mock.calls[1][0];
      expect(workerCall.system).toContain('software developer creating new files');
      expect(workerCall.prompt).toContain('Implement the changes');
    });
  });
});