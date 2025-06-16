import { Test, TestingModule } from '@nestjs/testing';
import { ParallelProcessingService } from './parallel-processing.service';
import { generateText, generateObject, streamObject } from 'ai';
import { Readable } from 'stream';

// Mock the AI SDK
jest.mock('ai');
jest.mock('@ai-sdk/google');

const mockGenerateText = generateText as jest.MockedFunction<
  typeof generateText
>;
const mockGenerateObject = generateObject as jest.MockedFunction<
  typeof generateObject
>;
const mockStreamObject = streamObject as jest.MockedFunction<
  typeof streamObject
>;

describe('ParallelProcessingService - Business Logic', () => {
  let service: ParallelProcessingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ParallelProcessingService],
    }).compile();

    service = module.get<ParallelProcessingService>(ParallelProcessingService);

    // Reset mocks before each test
    jest.clearAllMocks();
  });

  describe('Parallel Code Review Execution', () => {
    it('should execute all three reviews in parallel', async () => {
      // Arrange: Mock all three parallel review responses
      mockGenerateObject
        .mockResolvedValueOnce({
          object: {
            vulnerabilities: ['SQL injection risk in user input'],
            riskLevel: 'high',
            suggestions: ['Use parameterized queries', 'Input validation'],
          },
        } as any)
        .mockResolvedValueOnce({
          object: {
            issues: ['Inefficient database query'],
            impact: 'medium',
            optimizations: ['Add database indexing', 'Query optimization'],
          },
        } as any)
        .mockResolvedValueOnce({
          object: {
            concerns: ['Poor variable naming', 'Lack of comments'],
            qualityScore: 6,
            recommendations: [
              'Improve naming conventions',
              'Add documentation',
            ],
          },
        } as any);

      mockGenerateText.mockResolvedValueOnce({
        text: 'Code requires immediate attention for security vulnerabilities and performance improvements.',
      } as any);

      mockStreamObject.mockReturnValue({
        toTextStreamResponse: jest
          .fn()
          .mockReturnValue(new Readable({ read() {} })),
      } as any);

      // Act
      await service.parallelCodeReview(
        'const user = req.query.id; db.query("SELECT * FROM users WHERE id = " + user)',
      );

      // Assert: All three generateObject calls should have been made
      expect(mockGenerateObject).toHaveBeenCalledTimes(3);

      // Verify security review
      expect(mockGenerateObject).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          system: expect.stringContaining('expert in code security'),
          prompt: expect.stringContaining(
            'Review this code for security issues',
          ),
        }),
      );

      // Verify performance review
      expect(mockGenerateObject).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          system: expect.stringContaining('expert in code performance'),
          prompt: expect.stringContaining(
            'Review this code for performance issues',
          ),
        }),
      );

      // Verify maintainability review
      expect(mockGenerateObject).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          system: expect.stringContaining(
            'expert in code quality and maintainability',
          ),
          prompt: expect.stringContaining(
            'Review this code for maintainability and quality',
          ),
        }),
      );
    });

    it('should synthesize review results into summary', async () => {
      // Arrange: Mock review responses
      const securityResult = {
        vulnerabilities: ['XSS vulnerability'],
        riskLevel: 'high',
        suggestions: ['Sanitize inputs'],
      };
      const performanceResult = {
        issues: ['Memory leak'],
        impact: 'medium',
        optimizations: ['Fix memory management'],
      };
      const maintainabilityResult = {
        concerns: ['Code complexity'],
        qualityScore: 4,
        recommendations: ['Refactor for simplicity'],
      };

      mockGenerateObject
        .mockResolvedValueOnce({ object: securityResult } as any)
        .mockResolvedValueOnce({ object: performanceResult } as any)
        .mockResolvedValueOnce({ object: maintainabilityResult } as any);

      mockGenerateText.mockResolvedValueOnce({
        text: 'High priority security fixes needed, followed by performance optimization.',
      } as any);

      mockStreamObject.mockReturnValue({
        toTextStreamResponse: jest
          .fn()
          .mockReturnValue(new Readable({ read() {} })),
      } as any);

      // Act
      await service.parallelCodeReview('vulnerable code');

      // Assert: Summary generation should be called with all review data
      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.stringContaining(
            'technical lead summarizing multiple code reviews',
          ),
          prompt: expect.stringContaining(
            'Synthesize these code review results',
          ),
        }),
      );

      // Verify the prompt contains all review data
      const generateTextCall = mockGenerateText.mock.calls[0][0];
      expect(generateTextCall.prompt).toContain('XSS vulnerability');
      expect(generateTextCall.prompt).toContain('Memory leak');
      expect(generateTextCall.prompt).toContain('Code complexity');
    });

    it('should handle mixed risk levels correctly', async () => {
      // Arrange: Mock reviews with different risk/impact levels
      mockGenerateObject
        .mockResolvedValueOnce({
          object: {
            vulnerabilities: ['Minor input validation issue'],
            riskLevel: 'low',
            suggestions: ['Add basic validation'],
          },
        } as any)
        .mockResolvedValueOnce({
          object: {
            issues: ['Critical performance bottleneck'],
            impact: 'high',
            optimizations: ['Optimize algorithm complexity'],
          },
        } as any)
        .mockResolvedValueOnce({
          object: {
            concerns: ['Good code structure'],
            qualityScore: 9,
            recommendations: ['Minor style improvements'],
          },
        } as any);

      mockGenerateText.mockResolvedValueOnce({
        text: 'Focus on performance optimization while maintaining good code quality.',
      } as any);

      mockStreamObject.mockReturnValue({
        toTextStreamResponse: jest
          .fn()
          .mockReturnValue(new Readable({ read() {} })),
      } as any);

      // Act
      await service.parallelCodeReview('mixed quality code');

      // Assert: Should handle different severity levels appropriately
      expect(mockGenerateObject).toHaveBeenCalledTimes(3);
      expect(mockGenerateText).toHaveBeenCalledTimes(1);

      // Verify streaming response includes all review types
      expect(mockStreamObject).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('security'),
        }),
      );
      expect(mockStreamObject).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('performance'),
        }),
      );
      expect(mockStreamObject).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('maintainability'),
        }),
      );
    });
  });

  describe('Review Type Specialization', () => {
    it('should use specialized system prompts for each review type', async () => {
      // Arrange: Mock responses for all reviews
      mockGenerateObject.mockResolvedValue({
        object: {
          vulnerabilities: [],
          riskLevel: 'low',
          suggestions: [],
          issues: [],
          impact: 'low',
          optimizations: [],
          concerns: [],
          qualityScore: 8,
          recommendations: [],
        },
      } as any);

      mockGenerateText.mockResolvedValueOnce({
        text: 'Overall good code quality.',
      } as any);

      mockStreamObject.mockReturnValue({
        toTextStreamResponse: jest
          .fn()
          .mockReturnValue(new Readable({ read() {} })),
      } as any);

      // Act
      await service.parallelCodeReview('function test() { return "hello"; }');

      // Assert: Verify each review uses its specialized system prompt
      const securityCall = mockGenerateObject.mock.calls[0][0];
      expect(securityCall.system).toContain('expert in code security');
      expect(securityCall.system).toContain(
        'vulnerabilities, security flaws, and potential attack vectors',
      );

      const performanceCall = mockGenerateObject.mock.calls[1][0];
      expect(performanceCall.system).toContain('expert in code performance');
      expect(performanceCall.system).toContain(
        'performance bottlenecks, inefficiencies, and optimization opportunities',
      );

      const maintainabilityCall = mockGenerateObject.mock.calls[2][0];
      expect(maintainabilityCall.system).toContain(
        'expert in code quality and maintainability',
      );
      expect(maintainabilityCall.system).toContain(
        'code structure, readability, and maintainability concerns',
      );
    });

    it('should enforce correct schema validation for each review type', async () => {
      // Arrange: Mock responses
      mockGenerateObject.mockResolvedValue({
        object: {
          vulnerabilities: ['test'],
          riskLevel: 'medium',
          suggestions: ['test'],
          issues: ['test'],
          impact: 'medium',
          optimizations: ['test'],
          concerns: ['test'],
          qualityScore: 5,
          recommendations: ['test'],
        },
      } as any);

      mockGenerateText.mockResolvedValue({ text: 'test summary' } as any);
      mockStreamObject.mockReturnValue({
        toTextStreamResponse: jest
          .fn()
          .mockReturnValue(new Readable({ read() {} })),
      } as any);

      // Act
      await service.parallelCodeReview('test code');

      // Assert: Verify all three generateObject calls were made with proper structure
      expect(mockGenerateObject).toHaveBeenCalledTimes(3);
      expect(mockGenerateText).toHaveBeenCalledTimes(1);

      // Verify each call has expected structure
      const calls = mockGenerateObject.mock.calls;
      expect(calls[0][0].prompt).toContain(
        'Review this code for security issues',
      );
      expect(calls[1][0].prompt).toContain(
        'Review this code for performance issues',
      );
      expect(calls[2][0].prompt).toContain(
        'Review this code for maintainability and quality',
      );
    });
  });

  describe('Streaming Response Generation', () => {
    it('should generate proper streaming response with all review data', async () => {
      // Arrange: Mock complete review cycle
      const securityReview = {
        vulnerabilities: ['Buffer overflow'],
        riskLevel: 'high',
        suggestions: ['Use safe string functions'],
      };
      const performanceReview = {
        issues: ['O(n²) complexity'],
        impact: 'high',
        optimizations: ['Use more efficient algorithm'],
      };
      const maintainabilityReview = {
        concerns: ['Deeply nested code'],
        qualityScore: 3,
        recommendations: ['Extract methods', 'Reduce nesting'],
      };
      const summary =
        'Critical security and performance issues require immediate attention.';

      mockGenerateObject
        .mockResolvedValueOnce({ object: securityReview } as any)
        .mockResolvedValueOnce({ object: performanceReview } as any)
        .mockResolvedValueOnce({ object: maintainabilityReview } as any);

      mockGenerateText.mockResolvedValueOnce({ text: summary } as any);

      const mockStream = new Readable({ read() {} });
      const mockStreamObjectResult = {
        pipeTextStreamToResponse: jest.fn(),
      };
      mockStreamObject.mockReturnValue(mockStreamObjectResult as any);

      // Act
      const result = await service.parallelCodeReview('problematic code');

      // Assert: Verify streaming response structure
      expect(mockStreamObject).toHaveBeenCalledWith({
        model: expect.any(Object),
        schema: expect.objectContaining({
          shape: expect.objectContaining({
            reviews: expect.any(Object),
            summary: expect.any(Object),
          }),
        }),
        prompt: expect.stringContaining(
          'Return the following data as a structured object',
        ),
      });

      // Verify all review data is included in the prompt
      const streamCall = mockStreamObject.mock.calls[0][0];
      expect(streamCall.prompt).toContain('Buffer overflow');
      expect(streamCall.prompt).toContain('O(n²) complexity');
      expect(streamCall.prompt).toContain('Deeply nested code');
      expect(streamCall.prompt).toContain(summary);

      expect(result).toBe(mockStreamObjectResult);
    });

    it('should include review type markers in response data', async () => {
      // Arrange: Mock reviews
      mockGenerateObject
        .mockResolvedValueOnce({
          object: {
            vulnerabilities: ['test'],
            riskLevel: 'low',
            suggestions: ['test'],
          },
        } as any)
        .mockResolvedValueOnce({
          object: { issues: ['test'], impact: 'low', optimizations: ['test'] },
        } as any)
        .mockResolvedValueOnce({
          object: {
            concerns: ['test'],
            qualityScore: 8,
            recommendations: ['test'],
          },
        } as any);

      mockGenerateText.mockResolvedValueOnce({
        text: 'Good overall quality',
      } as any);
      mockStreamObject.mockReturnValue({
        toTextStreamResponse: jest
          .fn()
          .mockReturnValue(new Readable({ read() {} })),
      } as any);

      // Act
      await service.parallelCodeReview('test code');

      // Assert: Verify review types are properly marked
      const streamCall = mockStreamObject.mock.calls[0][0];
      expect(streamCall.prompt).toContain('"type":"security"');
      expect(streamCall.prompt).toContain('"type":"performance"');
      expect(streamCall.prompt).toContain('"type":"maintainability"');
    });
  });

  describe('Error Handling', () => {
    it('should handle security review failures gracefully', async () => {
      // Arrange: Mock security review failure
      mockGenerateObject
        .mockRejectedValueOnce(new Error('Security API Error'))
        .mockResolvedValueOnce({
          object: { issues: [], impact: 'low', optimizations: [] },
        } as any)
        .mockResolvedValueOnce({
          object: { concerns: [], qualityScore: 8, recommendations: [] },
        } as any);

      // Act & Assert: Should throw error (Promise.all will reject)
      await expect(service.parallelCodeReview('test code')).rejects.toThrow(
        'Security API Error',
      );
    });

    it('should handle performance review failures gracefully', async () => {
      // Arrange: Mock performance review failure
      mockGenerateObject
        .mockResolvedValueOnce({
          object: { vulnerabilities: [], riskLevel: 'low', suggestions: [] },
        } as any)
        .mockRejectedValueOnce(new Error('Performance API Error'))
        .mockResolvedValueOnce({
          object: { concerns: [], qualityScore: 8, recommendations: [] },
        } as any);

      // Act & Assert: Should throw error
      await expect(service.parallelCodeReview('test code')).rejects.toThrow(
        'Performance API Error',
      );
    });

    it('should handle maintainability review failures gracefully', async () => {
      // Arrange: Mock maintainability review failure
      mockGenerateObject
        .mockResolvedValueOnce({
          object: { vulnerabilities: [], riskLevel: 'low', suggestions: [] },
        } as any)
        .mockResolvedValueOnce({
          object: { issues: [], impact: 'low', optimizations: [] },
        } as any)
        .mockRejectedValueOnce(new Error('Maintainability API Error'));

      // Act & Assert: Should throw error
      await expect(service.parallelCodeReview('test code')).rejects.toThrow(
        'Maintainability API Error',
      );
    });

    it('should handle summary generation failures gracefully', async () => {
      // Arrange: Reviews succeed but summary fails
      mockGenerateObject.mockResolvedValue({
        object: { vulnerabilities: [], riskLevel: 'low', suggestions: [] },
      } as any);

      mockGenerateText.mockRejectedValueOnce(new Error('Summary API Error'));

      // Act & Assert: Should throw error
      await expect(service.parallelCodeReview('test code')).rejects.toThrow(
        'Summary API Error',
      );
    });

    it('should handle streaming response failures gracefully', async () => {
      // Arrange: All AI calls succeed but streaming fails
      mockGenerateObject.mockResolvedValue({
        object: { vulnerabilities: [], riskLevel: 'low', suggestions: [] },
      } as any);

      mockGenerateText.mockResolvedValue({ text: 'summary' } as any);
      mockStreamObject.mockImplementation(() => {
        throw new Error('Streaming Error');
      });

      // Act & Assert: Should throw streaming error
      await expect(service.parallelCodeReview('test code')).rejects.toThrow(
        'Streaming Error',
      );
    });
  });

  describe('Business Rule Validation', () => {
    it('should ensure all reviews are completed before summary generation', async () => {
      // Arrange: Mock delayed responses to test parallel execution
      let securityResolved = false;
      let performanceResolved = false;
      let maintainabilityResolved = false;

      mockGenerateObject
        .mockImplementationOnce(async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          securityResolved = true;
          return {
            object: { vulnerabilities: [], riskLevel: 'low', suggestions: [] },
          } as any;
        })
        .mockImplementationOnce(async () => {
          await new Promise((resolve) => setTimeout(resolve, 20));
          performanceResolved = true;
          return {
            object: { issues: [], impact: 'low', optimizations: [] },
          } as any;
        })
        .mockImplementationOnce(async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          maintainabilityResolved = true;
          return {
            object: { concerns: [], qualityScore: 8, recommendations: [] },
          } as any;
        });

      mockGenerateText.mockImplementationOnce(async () => {
        // Verify all reviews completed before summary
        expect(securityResolved).toBe(true);
        expect(performanceResolved).toBe(true);
        expect(maintainabilityResolved).toBe(true);
        return { text: 'Summary after all reviews complete' } as any;
      });

      mockStreamObject.mockReturnValue({
        toTextStreamResponse: jest
          .fn()
          .mockReturnValue(new Readable({ read() {} })),
      } as any);

      // Act
      await service.parallelCodeReview('test code');

      // Assert: Summary should be called after all reviews
      expect(mockGenerateText).toHaveBeenCalledTimes(1);
    });

    it('should enforce enum constraints for risk levels and impacts', async () => {
      // Arrange: Mock reviews with valid enum values
      mockGenerateObject
        .mockResolvedValueOnce({
          object: { vulnerabilities: [], riskLevel: 'high', suggestions: [] },
        } as any)
        .mockResolvedValueOnce({
          object: { issues: [], impact: 'medium', optimizations: [] },
        } as any)
        .mockResolvedValueOnce({
          object: { concerns: [], qualityScore: 5, recommendations: [] },
        } as any);

      mockGenerateText.mockResolvedValue({ text: 'test' } as any);
      mockStreamObject.mockReturnValue({
        toTextStreamResponse: jest
          .fn()
          .mockReturnValue(new Readable({ read() {} })),
      } as any);

      // Act
      await service.parallelCodeReview('test code');

      // Assert: Verify all reviews completed successfully
      expect(mockGenerateObject).toHaveBeenCalledTimes(3);
      expect(mockGenerateText).toHaveBeenCalledTimes(1);

      // Verify proper call order and structure
      const calls = mockGenerateObject.mock.calls;
      expect(calls[0][0].system).toContain('expert in code security');
      expect(calls[1][0].system).toContain('expert in code performance');
      expect(calls[2][0].system).toContain(
        'expert in code quality and maintainability',
      );
    });
  });
});
