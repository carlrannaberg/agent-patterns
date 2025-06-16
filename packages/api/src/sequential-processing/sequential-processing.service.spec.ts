import { Test, TestingModule } from '@nestjs/testing';
import { SequentialProcessingService } from './sequential-processing.service';
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

describe('SequentialProcessingService - Business Logic', () => {
  let service: SequentialProcessingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SequentialProcessingService],
    }).compile();

    service = module.get<SequentialProcessingService>(
      SequentialProcessingService,
    );

    // Reset mocks before each test
    jest.clearAllMocks();
  });

  describe('Marketing Copy Quality Evaluation', () => {
    it('should not improve copy when quality metrics are high', async () => {
      // Arrange: Mock high-quality marketing copy
      mockGenerateText.mockResolvedValueOnce({
        text: 'Revolutionary eco-friendly water bottle - Buy now and save the planet!',
      } as any);

      mockGenerateObject.mockResolvedValueOnce({
        object: {
          hasCallToAction: true,
          emotionalAppeal: 9,
          clarity: 8,
        },
      } as any);

      mockStreamObject.mockReturnValue({
        toTextStreamResponse: jest
          .fn()
          .mockReturnValue(new Readable({ read() {} })),
      } as any);

      // Act
      await service.generateMarketingCopy('eco-friendly water bottle');

      // Assert: Should not call generateText again for improvement
      expect(mockGenerateText).toHaveBeenCalledTimes(1);
      expect(mockStreamObject).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('Was improved: false'),
        }),
      );
    });

    it('should improve copy when hasCallToAction is false', async () => {
      // Arrange: Mock copy without call to action
      mockGenerateText
        .mockResolvedValueOnce({
          text: 'This is an eco-friendly water bottle made from recycled materials.',
        } as any)
        .mockResolvedValueOnce({
          text: 'Revolutionary eco-friendly water bottle - Order yours today!',
        } as any);

      mockGenerateObject.mockResolvedValueOnce({
        object: {
          hasCallToAction: false, // Missing call to action
          emotionalAppeal: 8,
          clarity: 9,
        },
      } as any);

      mockStreamObject.mockReturnValue({
        toTextStreamResponse: jest
          .fn()
          .mockReturnValue(new Readable({ read() {} })),
      } as any);

      // Act
      await service.generateMarketingCopy('eco-friendly water bottle');

      // Assert: Should call generateText twice (original + improvement)
      expect(mockGenerateText).toHaveBeenCalledTimes(2);

      // Verify improvement prompt mentions call to action
      expect(mockGenerateText).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          prompt: expect.stringContaining('A clear call to action'),
        }),
      );

      expect(mockStreamObject).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('Was improved: true'),
        }),
      );
    });

    it('should improve copy when emotional appeal is below threshold', async () => {
      // Arrange: Mock copy with low emotional appeal
      mockGenerateText
        .mockResolvedValueOnce({
          text: 'Water bottle. Buy it.',
        } as any)
        .mockResolvedValueOnce({
          text: 'Transform your hydration experience with our revolutionary eco-bottle!',
        } as any);

      mockGenerateObject.mockResolvedValueOnce({
        object: {
          hasCallToAction: true,
          emotionalAppeal: 5, // Below threshold of 7
          clarity: 8,
        },
      } as any);

      mockStreamObject.mockReturnValue({
        toTextStreamResponse: jest
          .fn()
          .mockReturnValue(new Readable({ read() {} })),
      } as any);

      // Act
      await service.generateMarketingCopy('eco-friendly water bottle');

      // Assert: Should improve for emotional appeal
      expect(mockGenerateText).toHaveBeenCalledTimes(2);
      expect(mockGenerateText).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          prompt: expect.stringContaining('Stronger emotional appeal'),
        }),
      );
    });

    it('should improve copy when clarity is below threshold', async () => {
      // Arrange: Mock unclear copy
      mockGenerateText
        .mockResolvedValueOnce({
          text: 'This thing is good for stuff and you should maybe get one possibly.',
        } as any)
        .mockResolvedValueOnce({
          text: 'Crystal-clear hydration with our premium eco-friendly water bottle!',
        } as any);

      mockGenerateObject.mockResolvedValueOnce({
        object: {
          hasCallToAction: true,
          emotionalAppeal: 8,
          clarity: 4, // Below threshold of 7
        },
      } as any);

      mockStreamObject.mockReturnValue({
        toTextStreamResponse: jest
          .fn()
          .mockReturnValue(new Readable({ read() {} })),
      } as any);

      // Act
      await service.generateMarketingCopy('eco-friendly water bottle');

      // Assert: Should improve for clarity
      expect(mockGenerateText).toHaveBeenCalledTimes(2);
      expect(mockGenerateText).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          prompt: expect.stringContaining('Improved clarity and directness'),
        }),
      );
    });

    it('should improve copy when multiple metrics are below threshold', async () => {
      // Arrange: Mock copy with multiple issues
      mockGenerateText
        .mockResolvedValueOnce({
          text: 'Bottle exists.',
        } as any)
        .mockResolvedValueOnce({
          text: 'Revolutionary eco-bottle transforms your life - Order now for 50% off!',
        } as any);

      mockGenerateObject.mockResolvedValueOnce({
        object: {
          hasCallToAction: false,
          emotionalAppeal: 3,
          clarity: 4,
        },
      } as any);

      mockStreamObject.mockReturnValue({
        toTextStreamResponse: jest
          .fn()
          .mockReturnValue(new Readable({ read() {} })),
      } as any);

      // Act
      await service.generateMarketingCopy('eco-friendly water bottle');

      // Assert: Should improve with all needed enhancements
      expect(mockGenerateText).toHaveBeenCalledTimes(2);
      const improvementCall = mockGenerateText.mock.calls[1][0];
      expect(improvementCall.prompt).toContain('A clear call to action');
      expect(improvementCall.prompt).toContain('Stronger emotional appeal');
      expect(improvementCall.prompt).toContain(
        'Improved clarity and directness',
      );
    });
  });

  describe('Streaming Response Generation', () => {
    it('should generate proper streaming response with correct data structure', async () => {
      // Arrange
      const originalCopy = 'Original marketing copy';
      const finalCopy = 'Improved marketing copy';
      const qualityMetrics = {
        hasCallToAction: true,
        emotionalAppeal: 9,
        clarity: 8,
      };

      mockGenerateText
        .mockResolvedValueOnce({ text: originalCopy } as any)
        .mockResolvedValueOnce({ text: finalCopy } as any);

      mockGenerateObject.mockResolvedValueOnce({
        object: {
          hasCallToAction: false, // Will trigger improvement
          emotionalAppeal: 6,
          clarity: 9,
        },
      } as any);

      const mockStream = new Readable({ read() {} });
      const mockStreamObjectResult = {
        pipeTextStreamToResponse: jest.fn(),
      };
      mockStreamObject.mockReturnValue(mockStreamObjectResult as any);

      // Act
      const result = await service.generateMarketingCopy('test input');

      // Assert: Verify streaming response structure
      expect(mockStreamObject).toHaveBeenCalledWith({
        model: expect.any(Object),
        schema: expect.objectContaining({
          shape: expect.objectContaining({
            originalCopy: expect.any(Object),
            finalCopy: expect.any(Object),
            qualityMetrics: expect.any(Object),
            wasImproved: expect.any(Object),
          }),
        }),
        prompt: expect.stringContaining(
          'Return the following data as a structured object',
        ),
      });

      expect(result).toBe(mockStreamObjectResult);
    });
  });

  describe('Error Handling', () => {
    it('should handle AI generation failures gracefully', async () => {
      // Arrange: Mock AI failure
      mockGenerateText.mockRejectedValueOnce(new Error('AI API Error'));

      // Act & Assert: Should throw the error (or handle gracefully based on requirements)
      await expect(service.generateMarketingCopy('test input')).rejects.toThrow(
        'AI API Error',
      );
    });

    it('should handle malformed AI responses gracefully', async () => {
      // Arrange: Mock malformed response
      mockGenerateText.mockResolvedValueOnce({
        text: 'Valid marketing copy',
      } as any);

      mockGenerateObject.mockResolvedValueOnce({
        object: {
          // Missing required fields - but service handles this gracefully
          hasCallToAction: true,
          // emotionalAppeal missing - will be undefined
          // clarity missing - will be undefined
        },
      } as any);

      mockStreamObject.mockReturnValue({
        toTextStreamResponse: jest
          .fn()
          .mockReturnValue(new Readable({ read() {} })),
      } as any);

      // Act - Service should handle gracefully and not crash
      const result = await service.generateMarketingCopy('test input');

      // Assert: Should still return a stream (graceful handling)
      expect(result).toBeDefined();
      expect(mockStreamObject).toHaveBeenCalled();
    });
  });

  describe('Business Rule Validation', () => {
    it('should use correct quality thresholds for improvement decision', async () => {
      // Test the business rule: improve if emotionalAppeal < 7 OR clarity < 7 OR !hasCallToAction
      const testCases = [
        {
          hasCallToAction: true,
          emotionalAppeal: 7,
          clarity: 7,
          shouldImprove: false,
        },
        {
          hasCallToAction: true,
          emotionalAppeal: 6,
          clarity: 7,
          shouldImprove: true,
        },
        {
          hasCallToAction: true,
          emotionalAppeal: 7,
          clarity: 6,
          shouldImprove: true,
        },
        {
          hasCallToAction: false,
          emotionalAppeal: 9,
          clarity: 9,
          shouldImprove: true,
        },
      ];

      for (const testCase of testCases) {
        // Reset mocks
        jest.clearAllMocks();

        mockGenerateText.mockResolvedValue({ text: 'test copy' } as any);
        mockGenerateObject.mockResolvedValue({ object: testCase } as any);
        mockStreamObject.mockReturnValue({
          toTextStreamResponse: jest
            .fn()
            .mockReturnValue(new Readable({ read() {} })),
        } as any);

        await service.generateMarketingCopy('test');

        const expectedCalls = testCase.shouldImprove ? 2 : 1;
        expect(mockGenerateText).toHaveBeenCalledTimes(expectedCalls);
      }
    });
  });
});
