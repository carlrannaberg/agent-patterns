import { Test, TestingModule } from '@nestjs/testing';
import { MultiStepToolUsageService } from './multi-step-tool-usage.service';
import { generateText, streamObject } from 'ai';
import { Readable } from 'stream';

// Mock the AI SDK
jest.mock('ai');
jest.mock('@ai-sdk/google');
jest.mock('mathjs');

const mockGenerateText = generateText as jest.MockedFunction<
  typeof generateText
>;
const mockStreamObject = streamObject as jest.MockedFunction<
  typeof streamObject
>;

// Mock mathjs
const mockMathjs = require('mathjs');

describe('MultiStepToolUsageService - Business Logic', () => {
  let service: MultiStepToolUsageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MultiStepToolUsageService],
    }).compile();

    service = module.get<MultiStepToolUsageService>(MultiStepToolUsageService);

    // Reset mocks before each test
    jest.clearAllMocks();
  });

  describe('Math Problem Solving with Tool Usage', () => {
    it('should solve simple arithmetic problems using calculation tool', async () => {
      // Arrange: Mock generateText response with tool calls
      mockGenerateText.mockResolvedValueOnce({
        text: 'I need to calculate 15 + 25 to solve this problem.',
        toolCalls: [
          {
            toolCallId: 'calc-1',
            toolName: 'calculate',
            args: { expression: '15 + 25' },
          },
          {
            toolCallId: 'answer-1',
            toolName: 'answer',
            args: {
              steps: [
                { calculation: '15 + 25', reasoning: 'Adding the two numbers' },
              ],
              answer: '40',
            },
          },
        ],
        toolResults: [
          {
            toolCallId: 'calc-1',
            result: { result: '40', expression: '15 + 25' },
          },
        ],
      } as any);

      mockMathjs.evaluate.mockReturnValueOnce(40);

      mockStreamObject.mockReturnValue({
        toTextStreamResponse: jest
          .fn()
          .mockReturnValue(new Readable({ read() {} })),
      } as any);

      // Act
      await service.solveMathProblem('What is 15 + 25?');

      // Assert: Should use tools appropriately
      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: expect.objectContaining({
            calculate: expect.any(Object),
            answer: expect.any(Object),
          }),
          toolChoice: 'required',
          system: expect.stringContaining('solving math problems step by step'),
          prompt: 'What is 15 + 25?',
        }),
      );
    });

    it('should handle multi-step calculations correctly', async () => {
      // Arrange: Mock complex calculation with multiple steps
      mockGenerateText.mockResolvedValueOnce({
        text: 'First I calculate 5 * 3, then add 10 to the result.',
        toolCalls: [
          {
            toolCallId: 'calc-1',
            toolName: 'calculate',
            args: { expression: '5 * 3' },
          },
          {
            toolCallId: 'calc-2',
            toolName: 'calculate',
            args: { expression: '15 + 10' },
          },
          {
            toolCallId: 'answer-1',
            toolName: 'answer',
            args: {
              steps: [
                { calculation: '5 * 3', reasoning: 'Multiply 5 by 3' },
                {
                  calculation: '15 + 10',
                  reasoning: 'Add 10 to previous result',
                },
              ],
              answer: '25',
            },
          },
        ],
        toolResults: [
          {
            toolCallId: 'calc-1',
            result: { result: '15', expression: '5 * 3' },
          },
          {
            toolCallId: 'calc-2',
            result: { result: '25', expression: '15 + 10' },
          },
        ],
      } as any);

      mockMathjs.evaluate.mockReturnValueOnce(15).mockReturnValueOnce(25);

      mockStreamObject.mockReturnValue({
        toTextStreamResponse: jest
          .fn()
          .mockReturnValue(new Readable({ read() {} })),
      } as any);

      // Act
      await service.solveMathProblem('Calculate (5 * 3) + 10');

      // Assert: Should process multiple calculations in sequence
      expect(mockGenerateText).toHaveBeenCalledTimes(1);

      // Verify streaming response includes all calculation steps
      const streamCall = mockStreamObject.mock.calls[0][0];
      expect(streamCall.prompt).toContain('5 * 3');
      expect(streamCall.prompt).toContain('15 + 10');
      expect(streamCall.prompt).toContain('25');
    });

    it('should handle complex mathematical expressions', async () => {
      // Arrange: Mock advanced calculation
      mockGenerateText.mockResolvedValueOnce({
        text: 'I need to solve this quadratic equation step by step.',
        toolCalls: [
          {
            toolCallId: 'calc-1',
            toolName: 'calculate',
            args: { expression: '(-4 + sqrt(16 + 48)) / 4' },
          },
          {
            toolCallId: 'calc-2',
            toolName: 'calculate',
            args: { expression: '(-4 - sqrt(16 + 48)) / 4' },
          },
          {
            toolCallId: 'answer-1',
            toolName: 'answer',
            args: {
              steps: [
                {
                  calculation: '(-4 + sqrt(64)) / 4',
                  reasoning: 'Calculate positive root',
                },
                {
                  calculation: '(-4 - sqrt(64)) / 4',
                  reasoning: 'Calculate negative root',
                },
              ],
              answer: 'x = 1 or x = -3',
            },
          },
        ],
        toolResults: [
          {
            toolCallId: 'calc-1',
            result: { result: '1', expression: '(-4 + sqrt(16 + 48)) / 4' },
          },
          {
            toolCallId: 'calc-2',
            result: { result: '-3', expression: '(-4 - sqrt(16 + 48)) / 4' },
          },
        ],
      } as any);

      mockMathjs.evaluate.mockReturnValueOnce(1).mockReturnValueOnce(-3);

      mockStreamObject.mockReturnValue({
        toTextStreamResponse: jest
          .fn()
          .mockReturnValue(new Readable({ read() {} })),
      } as any);

      // Act
      await service.solveMathProblem('Solve x^2 + 3x - 4 = 0');

      // Assert: Should handle complex mathematical operations
      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'Solve x^2 + 3x - 4 = 0',
        }),
      );

      const streamCall = mockStreamObject.mock.calls[0][0];
      expect(streamCall.prompt).toContain('x = 1 or x = -3');
    });

    it('should process calculation results correctly', async () => {
      // Arrange: Mock calculation with specific results
      mockGenerateText.mockResolvedValueOnce({
        text: 'Calculating the area of a circle.',
        toolCalls: [
          {
            toolCallId: 'calc-1',
            toolName: 'calculate',
            args: { expression: 'pi * 5^2' },
          },
          {
            toolCallId: 'answer-1',
            toolName: 'answer',
            args: {
              steps: [{ calculation: 'pi * 5^2', reasoning: 'Area = π * r²' }],
              answer: '78.54',
            },
          },
        ],
        toolResults: [
          {
            toolCallId: 'calc-1',
            result: { result: '78.53981633974483', expression: 'pi * 5^2' },
          },
        ],
      } as any);

      mockMathjs.evaluate.mockReturnValueOnce(78.53981633974483);

      mockStreamObject.mockReturnValue({
        toTextStreamResponse: jest
          .fn()
          .mockReturnValue(new Readable({ read() {} })),
      } as any);

      // Act
      await service.solveMathProblem(
        'What is the area of a circle with radius 5?',
      );

      // Assert: Should include calculation results in streaming response
      const streamCall = mockStreamObject.mock.calls[0][0];
      expect(streamCall.prompt).toContain('pi * 5^2');
      expect(streamCall.prompt).toContain('78.53981633974483');
      expect(streamCall.prompt).toContain('78.54');
    });
  });

  describe('Tool Integration and Execution', () => {
    it('should execute calculation tool with mathjs correctly', async () => {
      // This test verifies the actual tool execution logic
      // Since we're mocking mathjs, we test the tool wrapper logic

      // Arrange: Mock a simple calculation
      mockGenerateText.mockResolvedValueOnce({
        text: 'Calculating 2 + 2',
        toolCalls: [
          {
            toolCallId: 'calc-1',
            toolName: 'calculate',
            args: { expression: '2 + 2' },
          },
          {
            toolCallId: 'answer-1',
            toolName: 'answer',
            args: {
              steps: [{ calculation: '2 + 2', reasoning: 'Basic addition' }],
              answer: '4',
            },
          },
        ],
        toolResults: [
          {
            toolCallId: 'calc-1',
            result: { result: '4', expression: '2 + 2' },
          },
        ],
      } as any);

      mockMathjs.evaluate.mockReturnValueOnce(4);

      mockStreamObject.mockReturnValue({
        toTextStreamResponse: jest
          .fn()
          .mockReturnValue(new Readable({ read() {} })),
      } as any);

      // Act
      await service.solveMathProblem('What is 2 + 2?');

      // Assert: Verify tool configuration
      const generateTextCall = mockGenerateText.mock.calls[0][0];
      expect(generateTextCall.tools).toBeDefined();
      expect(generateTextCall.toolChoice).toBe('required');
    });

    it('should handle calculation errors gracefully', async () => {
      // Arrange: Mock calculation that causes an error
      mockGenerateText.mockResolvedValueOnce({
        text: 'Attempting invalid calculation',
        toolCalls: [
          {
            toolCallId: 'calc-1',
            toolName: 'calculate',
            args: { expression: '1/0' },
          },
          {
            toolCallId: 'answer-1',
            toolName: 'answer',
            args: {
              steps: [
                { calculation: '1/0', reasoning: 'Division by zero test' },
              ],
              answer: 'Error: Division by zero',
            },
          },
        ],
        toolResults: [
          {
            toolCallId: 'calc-1',
            result: {
              error: 'Error evaluating expression: Division by zero',
              expression: '1/0',
            },
          },
        ],
      } as any);

      mockMathjs.evaluate.mockImplementationOnce(() => {
        throw new Error('Division by zero');
      });

      mockStreamObject.mockReturnValue({
        toTextStreamResponse: jest
          .fn()
          .mockReturnValue(new Readable({ read() {} })),
      } as any);

      // Act & Assert: Should handle error gracefully
      await expect(
        service.solveMathProblem('What is 1 divided by 0?'),
      ).resolves.toBeDefined();

      // Verify error is included in response
      const streamCall = mockStreamObject.mock.calls[0][0];
      expect(streamCall.prompt).toContain('Error: Division by zero');
    });

    it('should handle missing tool results gracefully', async () => {
      // Arrange: Mock response with missing tool results
      mockGenerateText.mockResolvedValueOnce({
        text: 'Calculation attempt',
        toolCalls: [
          {
            toolCallId: 'calc-1',
            toolName: 'calculate',
            args: { expression: '5 + 3' },
          },
          {
            toolCallId: 'answer-1',
            toolName: 'answer',
            args: {
              steps: [{ calculation: '5 + 3', reasoning: 'Addition' }],
              answer: '8',
            },
          },
        ],
        toolResults: [], // Empty tool results
      } as any);

      mockStreamObject.mockReturnValue({
        toTextStreamResponse: jest
          .fn()
          .mockReturnValue(new Readable({ read() {} })),
      } as any);

      // Act
      await service.solveMathProblem('What is 5 + 3?');

      // Assert: Should handle missing results gracefully
      const streamCall = mockStreamObject.mock.calls[0][0];
      expect(streamCall.prompt).toContain('Error'); // Should default to 'Error' for missing results
    });

    it('should extract final answer from answer tool correctly', async () => {
      // Arrange: Mock response with clear answer tool usage
      mockGenerateText.mockResolvedValueOnce({
        text: 'Solving percentage problem',
        toolCalls: [
          {
            toolCallId: 'calc-1',
            toolName: 'calculate',
            args: { expression: '150 * 0.20' },
          },
          {
            toolCallId: 'answer-1',
            toolName: 'answer',
            args: {
              steps: [
                {
                  calculation: '150 * 0.20',
                  reasoning: 'Calculate 20% of 150',
                },
              ],
              answer: '30',
            },
          },
        ],
        toolResults: [
          {
            toolCallId: 'calc-1',
            result: { result: '30', expression: '150 * 0.20' },
          },
        ],
      } as any);

      mockMathjs.evaluate.mockReturnValueOnce(30);

      mockStreamObject.mockReturnValue({
        toTextStreamResponse: jest
          .fn()
          .mockReturnValue(new Readable({ read() {} })),
      } as any);

      // Act
      await service.solveMathProblem('What is 20% of 150?');

      // Assert: Should extract and include final answer
      const streamCall = mockStreamObject.mock.calls[0][0];
      expect(streamCall.prompt).toContain('Final Answer: 30');
      expect(streamCall.prompt).toContain('20% of 150');
    });
  });

  describe('Streaming Response Generation', () => {
    it('should generate proper streaming response with all required fields', async () => {
      // Arrange: Mock complete problem-solving cycle
      mockGenerateText.mockResolvedValueOnce({
        text: 'Step-by-step solution',
        toolCalls: [
          {
            toolCallId: 'calc-1',
            toolName: 'calculate',
            args: { expression: '12 * 8' },
          },
          {
            toolCallId: 'answer-1',
            toolName: 'answer',
            args: {
              steps: [{ calculation: '12 * 8', reasoning: 'Multiply 12 by 8' }],
              answer: '96',
            },
          },
        ],
        toolResults: [
          {
            toolCallId: 'calc-1',
            result: { result: '96', expression: '12 * 8' },
          },
        ],
      } as any);

      mockMathjs.evaluate.mockReturnValueOnce(96);

      const mockStream = new Readable({ read() {} });
      const mockStreamObjectResult = {
        toTextStreamResponse: jest.fn().mockReturnValue(mockStream),
      };
      mockStreamObject.mockReturnValue(mockStreamObjectResult as any);

      // Act
      const result = await service.solveMathProblem('Calculate 12 times 8');

      // Assert: Verify streaming response structure
      expect(mockStreamObject).toHaveBeenCalledWith({
        model: expect.any(Object),
        schema: expect.objectContaining({
          shape: expect.objectContaining({
            problem: expect.any(Object),
            calculations: expect.any(Object),
            steps: expect.any(Object),
            finalAnswer: expect.any(Object),
            workingSteps: expect.any(Object),
          }),
        }),
        prompt: expect.stringContaining(
          'Return the following data as a structured object',
        ),
      });

      // Verify all required data is included
      const streamCall = mockStreamObject.mock.calls[0][0];
      expect(streamCall.prompt).toContain('Problem: Calculate 12 times 8');
      expect(streamCall.prompt).toContain('12 * 8');
      expect(streamCall.prompt).toContain('Final Answer: 96');
      expect(streamCall.prompt).toContain('Step-by-step solution');

      expect(result).toBe(mockStreamObjectResult);
    });

    it('should include all calculation steps in response', async () => {
      // Arrange: Mock multi-step calculation
      mockGenerateText.mockResolvedValueOnce({
        text: 'Multi-step calculation process',
        toolCalls: [
          {
            toolCallId: 'calc-1',
            toolName: 'calculate',
            args: { expression: '10 + 5' },
          },
          {
            toolCallId: 'calc-2',
            toolName: 'calculate',
            args: { expression: '15 * 2' },
          },
          {
            toolCallId: 'calc-3',
            toolName: 'calculate',
            args: { expression: '30 - 5' },
          },
          {
            toolCallId: 'answer-1',
            toolName: 'answer',
            args: {
              steps: [
                { calculation: '10 + 5', reasoning: 'First add 10 and 5' },
                { calculation: '15 * 2', reasoning: 'Then multiply by 2' },
                { calculation: '30 - 5', reasoning: 'Finally subtract 5' },
              ],
              answer: '25',
            },
          },
        ],
        toolResults: [
          {
            toolCallId: 'calc-1',
            result: { result: '15', expression: '10 + 5' },
          },
          {
            toolCallId: 'calc-2',
            result: { result: '30', expression: '15 * 2' },
          },
          {
            toolCallId: 'calc-3',
            result: { result: '25', expression: '30 - 5' },
          },
        ],
      } as any);

      mockMathjs.evaluate
        .mockReturnValueOnce(15)
        .mockReturnValueOnce(30)
        .mockReturnValueOnce(25);

      mockStreamObject.mockReturnValue({
        toTextStreamResponse: jest
          .fn()
          .mockReturnValue(new Readable({ read() {} })),
      } as any);

      // Act
      await service.solveMathProblem('Calculate (10 + 5) * 2 - 5');

      // Assert: All calculation steps should be included
      const streamCall = mockStreamObject.mock.calls[0][0];
      expect(streamCall.prompt).toContain('10 + 5');
      expect(streamCall.prompt).toContain('15 * 2');
      expect(streamCall.prompt).toContain('30 - 5');
      expect(streamCall.prompt).toContain('"step":1');
      expect(streamCall.prompt).toContain('"step":2');
      expect(streamCall.prompt).toContain('"step":3');
    });
  });

  describe('Error Handling', () => {
    it('should handle generateText failures gracefully', async () => {
      // Arrange: Mock generateText failure
      mockGenerateText.mockRejectedValueOnce(new Error('AI API Error'));

      // Act & Assert: Should throw the error
      await expect(service.solveMathProblem('test problem')).rejects.toThrow(
        'AI API Error',
      );
    });

    it('should handle streaming response failures gracefully', async () => {
      // Arrange: generateText succeeds but streaming fails
      mockGenerateText.mockResolvedValueOnce({
        text: 'Solution text',
        toolCalls: [
          {
            toolCallId: 'answer-1',
            toolName: 'answer',
            args: {
              steps: [{ calculation: '2+2', reasoning: 'test' }],
              answer: '4',
            },
          },
        ],
        toolResults: [],
      } as any);

      mockStreamObject.mockImplementation(() => {
        throw new Error('Streaming Error');
      });

      // Act & Assert: Should throw streaming error
      await expect(service.solveMathProblem('test problem')).rejects.toThrow(
        'Streaming Error',
      );
    });

    it('should handle malformed tool responses gracefully', async () => {
      // Arrange: Mock malformed tool calls
      mockGenerateText.mockResolvedValueOnce({
        text: 'Malformed response',
        toolCalls: [
          {
            toolCallId: 'calc-1',
            toolName: 'calculate',
            args: {}, // Missing expression
          },
        ],
        toolResults: [],
      } as any);

      mockStreamObject.mockReturnValue({
        toTextStreamResponse: jest
          .fn()
          .mockReturnValue(new Readable({ read() {} })),
      } as any);

      // Act: Should handle gracefully
      await service.solveMathProblem('malformed problem');

      // Assert: Should include empty/error values for malformed data
      const streamCall = mockStreamObject.mock.calls[0][0];
      expect(streamCall.prompt).toContain('No answer provided');
    });
  });

  describe('Business Rule Validation', () => {
    it('should enforce required tool usage', async () => {
      // Arrange: Mock response without required tools
      mockGenerateText.mockResolvedValueOnce({
        text: 'Response without tools',
        toolCalls: [],
        toolResults: [],
      } as any);

      mockStreamObject.mockReturnValue({
        toTextStreamResponse: jest
          .fn()
          .mockReturnValue(new Readable({ read() {} })),
      } as any);

      // Act
      await service.solveMathProblem('simple problem');

      // Assert: Should enforce tool usage requirement
      const generateTextCall = mockGenerateText.mock.calls[0][0];
      expect(generateTextCall.toolChoice).toBe('required');

      // Should include fallback values when no tools used
      const streamCall = mockStreamObject.mock.calls[0][0];
      expect(streamCall.prompt).toContain('No answer provided');
    });

    it('should provide appropriate system prompt for math solving', async () => {
      // Arrange: Mock standard response
      mockGenerateText.mockResolvedValueOnce({
        text: 'Math solution',
        toolCalls: [
          {
            toolCallId: 'answer-1',
            toolName: 'answer',
            args: {
              steps: [{ calculation: 'test', reasoning: 'test' }],
              answer: 'test',
            },
          },
        ],
        toolResults: [],
      } as any);

      mockStreamObject.mockReturnValue({
        toTextStreamResponse: jest
          .fn()
          .mockReturnValue(new Readable({ read() {} })),
      } as any);

      // Act
      await service.solveMathProblem('test problem');

      // Assert: Should use appropriate system prompt
      const generateTextCall = mockGenerateText.mock.calls[0][0];
      expect(generateTextCall.system).toContain(
        'solving math problems step by step',
      );
      expect(generateTextCall.system).toContain(
        'calculate tool for any mathematical operations',
      );
      expect(generateTextCall.system).toContain(
        'provide the final answer with the answer tool',
      );
    });

    it('should properly structure calculation results', async () => {
      // Arrange: Mock calculation with proper structure
      mockGenerateText.mockResolvedValueOnce({
        text: 'Structured calculation',
        toolCalls: [
          {
            toolCallId: 'calc-1',
            toolName: 'calculate',
            args: { expression: '7 * 6' },
          },
          {
            toolCallId: 'answer-1',
            toolName: 'answer',
            args: {
              steps: [{ calculation: '7 * 6', reasoning: 'Multiply 7 by 6' }],
              answer: '42',
            },
          },
        ],
        toolResults: [
          {
            toolCallId: 'calc-1',
            result: { result: '42', expression: '7 * 6' },
          },
        ],
      } as any);

      mockMathjs.evaluate.mockReturnValueOnce(42);

      mockStreamObject.mockReturnValue({
        toTextStreamResponse: jest
          .fn()
          .mockReturnValue(new Readable({ read() {} })),
      } as any);

      // Act
      await service.solveMathProblem('What is 7 times 6?');

      // Assert: Should structure calculation results properly
      const streamCall = mockStreamObject.mock.calls[0][0];
      expect(streamCall.prompt).toContain('"expression":"7 * 6"');
      expect(streamCall.prompt).toContain('"result":"42"');
      expect(streamCall.prompt).toContain('"step":1');
    });
  });
});
