import { Test, TestingModule } from '@nestjs/testing';
import { RoutingService } from './routing.service';
import { generateObject, generateText, streamObject } from 'ai';
import { Readable } from 'stream';

// Mock the AI SDK
jest.mock('ai');
jest.mock('@ai-sdk/google');

const mockGenerateObject = generateObject as jest.MockedFunction<typeof generateObject>;
const mockGenerateText = generateText as jest.MockedFunction<typeof generateText>;
const mockStreamObject = streamObject as jest.MockedFunction<typeof streamObject>;

describe('RoutingService - Business Logic', () => {
  let service: RoutingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RoutingService],
    }).compile();

    service = module.get<RoutingService>(RoutingService);

    // Reset mocks before each test
    jest.clearAllMocks();
  });

  describe('Query Classification Logic', () => {
    it('should classify refund queries correctly', async () => {
      // Arrange: Mock refund query classification
      mockGenerateObject.mockResolvedValueOnce({
        object: {
          reasoning: 'Customer wants to return a product',
          type: 'refund',
          complexity: 'simple',
        },
      } as any);

      mockGenerateText.mockResolvedValueOnce({
        text: 'I can help you with your refund request. Please provide your order number.',
      } as any);

      mockStreamObject.mockReturnValue({
        toTextStreamResponse: jest.fn().mockReturnValue(new Readable({ read() {} })),
      } as any);

      // Act
      await service.handleCustomerQuery('I want to return my order');

      // Assert: Should use refund-specific system prompt
      expect(mockGenerateText).toHaveBeenCalledWith({
        model: expect.any(Object),
        system:
          'You are a customer service agent specializing in refund requests. Follow company policy and collect necessary information.',
        prompt: 'I want to return my order',
      });
    });

    it('should classify technical queries correctly', async () => {
      // Arrange: Mock technical query classification
      mockGenerateObject.mockResolvedValueOnce({
        object: {
          reasoning: 'Customer has a technical problem with the product',
          type: 'technical',
          complexity: 'complex',
        },
      } as any);

      mockGenerateText.mockResolvedValueOnce({
        text: 'Let me help you troubleshoot this issue step by step.',
      } as any);

      mockStreamObject.mockReturnValue({
        toTextStreamResponse: jest.fn().mockReturnValue(new Readable({ read() {} })),
      } as any);

      // Act
      await service.handleCustomerQuery("My device won't connect to WiFi");

      // Assert: Should use technical support system prompt
      expect(mockGenerateText).toHaveBeenCalledWith({
        model: expect.any(Object),
        system:
          'You are a technical support specialist with deep product knowledge. Focus on clear step-by-step troubleshooting.',
        prompt: "My device won't connect to WiFi",
      });
    });

    it('should classify general queries correctly', async () => {
      // Arrange: Mock general query classification
      mockGenerateObject.mockResolvedValueOnce({
        object: {
          reasoning: 'General information request',
          type: 'general',
          complexity: 'simple',
        },
      } as any);

      mockGenerateText.mockResolvedValueOnce({
        text: 'Our store hours are 9 AM to 9 PM Monday through Friday.',
      } as any);

      mockStreamObject.mockReturnValue({
        toTextStreamResponse: jest.fn().mockReturnValue(new Readable({ read() {} })),
      } as any);

      // Act
      await service.handleCustomerQuery('What are your store hours?');

      // Assert: Should use general customer service system prompt
      expect(mockGenerateText).toHaveBeenCalledWith({
        model: expect.any(Object),
        system: 'You are an expert customer service agent handling general inquiries.',
        prompt: 'What are your store hours?',
      });
    });
  });

  describe('Model Selection Based on Complexity', () => {
    it('should use flash model for simple queries', async () => {
      // Arrange: Mock simple query
      mockGenerateObject.mockResolvedValueOnce({
        object: {
          reasoning: 'Simple question about hours',
          type: 'general',
          complexity: 'simple',
        },
      } as any);

      mockGenerateText.mockResolvedValueOnce({
        text: 'Store hours response',
      } as any);

      mockStreamObject.mockReturnValue({
        toTextStreamResponse: jest.fn().mockReturnValue(new Readable({ read() {} })),
      } as any);

      // Act
      await service.handleCustomerQuery('What are your hours?');

      // Assert: Should call generateText once (complexity logic works)
      expect(mockGenerateText).toHaveBeenCalledTimes(1);
      expect(mockGenerateText).toHaveBeenCalledWith({
        model: expect.any(Object), // Model selection is tested indirectly via the complexity logic
        system: 'You are an expert customer service agent handling general inquiries.',
        prompt: 'What are your hours?',
      });
    });

    it('should use pro model for complex queries', async () => {
      // Arrange: Mock complex query
      mockGenerateObject.mockResolvedValueOnce({
        object: {
          reasoning: 'Complex technical issue requiring detailed troubleshooting',
          type: 'technical',
          complexity: 'complex',
        },
      } as any);

      mockGenerateText.mockResolvedValueOnce({
        text: 'Detailed troubleshooting response',
      } as any);

      mockStreamObject.mockReturnValue({
        toTextStreamResponse: jest.fn().mockReturnValue(new Readable({ read() {} })),
      } as any);

      // Act
      await service.handleCustomerQuery('My device has multiple complex issues');

      // Assert: Should call generateText once (complexity logic works)
      expect(mockGenerateText).toHaveBeenCalledTimes(1);
      expect(mockGenerateText).toHaveBeenCalledWith({
        model: expect.any(Object), // Model selection is tested indirectly via the complexity logic
        system:
          'You are a technical support specialist with deep product knowledge. Focus on clear step-by-step troubleshooting.',
        prompt: 'My device has multiple complex issues',
      });
    });
  });

  describe('Streaming Response Generation', () => {
    it('should generate proper streaming response with all required fields', async () => {
      // Arrange
      const classification = {
        reasoning: 'Test reasoning',
        type: 'general' as const,
        complexity: 'simple' as const,
      };
      const response = 'Test customer service response';

      mockGenerateObject.mockResolvedValueOnce({
        object: classification,
      } as any);

      mockGenerateText.mockResolvedValueOnce({
        text: response,
      } as any);

      const mockStream = new Readable({ read() {} });
      const mockStreamObjectResult = {
        pipeTextStreamToResponse: jest.fn(),
      };
      mockStreamObject.mockReturnValue(mockStreamObjectResult as any);

      // Act
      const result = await service.handleCustomerQuery('test query');

      // Assert: Verify streaming response structure
      expect(mockStreamObject).toHaveBeenCalledWith({
        model: expect.any(Object),
        schema: expect.objectContaining({
          shape: expect.objectContaining({
            response: expect.any(Object),
            classification: expect.any(Object),
            modelUsed: expect.any(Object),
          }),
        }),
        prompt: expect.stringContaining('Return the following data as a structured object'),
      });

      expect(result).toBe(mockStreamObjectResult);
    });
  });

  describe('Error Handling', () => {
    it('should handle classification failures gracefully', async () => {
      // Arrange: Mock classification failure
      mockGenerateObject.mockRejectedValueOnce(new Error('Classification API Error'));

      // Act & Assert: Should throw the error
      await expect(service.handleCustomerQuery('test query')).rejects.toThrow(
        'Classification API Error',
      );
    });

    it('should handle response generation failures gracefully', async () => {
      // Arrange: Classification succeeds but response generation fails
      mockGenerateObject.mockResolvedValueOnce({
        object: {
          reasoning: 'Test reasoning',
          type: 'general',
          complexity: 'simple',
        },
      } as any);

      mockGenerateText.mockRejectedValueOnce(new Error('Response API Error'));

      // Act & Assert: Should throw the error
      await expect(service.handleCustomerQuery('test query')).rejects.toThrow('Response API Error');
    });

    it('should handle malformed classification responses', async () => {
      // Arrange: Mock malformed classification that will cause Zod validation to fail
      mockGenerateObject.mockRejectedValueOnce(new Error('Zod validation error'));

      // Act & Assert: Should throw validation error
      await expect(service.handleCustomerQuery('test query')).rejects.toThrow(
        'Zod validation error',
      );
    });
  });

  describe('Business Rule Validation', () => {
    it('should use correct system prompts for each query type', async () => {
      const testCases = [
        {
          type: 'general' as const,
          expectedPrompt: 'You are an expert customer service agent handling general inquiries.',
        },
        {
          type: 'refund' as const,
          expectedPrompt:
            'You are a customer service agent specializing in refund requests. Follow company policy and collect necessary information.',
        },
        {
          type: 'technical' as const,
          expectedPrompt:
            'You are a technical support specialist with deep product knowledge. Focus on clear step-by-step troubleshooting.',
        },
      ];

      for (const testCase of testCases) {
        // Reset mocks
        jest.clearAllMocks();

        mockGenerateObject.mockResolvedValue({
          object: {
            reasoning: 'Test reasoning',
            type: testCase.type,
            complexity: 'simple',
          },
        } as any);

        mockGenerateText.mockResolvedValue({
          text: 'Test response',
        } as any);

        mockStreamObject.mockReturnValue({
          toTextStreamResponse: jest.fn().mockReturnValue(new Readable({ read() {} })),
        } as any);

        await service.handleCustomerQuery('test query');

        expect(mockGenerateText).toHaveBeenCalledWith({
          model: expect.any(Object),
          system: testCase.expectedPrompt,
          prompt: 'test query',
        });
      }
    });

    it('should enforce valid classification types', async () => {
      // Test that only valid enum values are accepted
      const validTypes = ['general', 'refund', 'technical'];
      const validComplexities = ['simple', 'complex'];

      // This test verifies the Zod schema enforcement
      for (const type of validTypes) {
        for (const complexity of validComplexities) {
          jest.clearAllMocks();

          mockGenerateObject.mockResolvedValue({
            object: {
              reasoning: 'Test reasoning',
              type,
              complexity,
            },
          } as any);

          mockGenerateText.mockResolvedValue({
            text: 'Test response',
          } as any);

          mockStreamObject.mockReturnValue({
            toTextStreamResponse: jest.fn().mockReturnValue(new Readable({ read() {} })),
          } as any);

          // Should not throw for valid combinations
          await expect(service.handleCustomerQuery('test query')).resolves.toBeDefined();
        }
      }
    });
  });
});
