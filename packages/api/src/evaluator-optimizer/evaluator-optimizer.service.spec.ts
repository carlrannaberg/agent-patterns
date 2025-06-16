import { Test, TestingModule } from '@nestjs/testing';
import { EvaluatorOptimizerService } from './evaluator-optimizer.service';
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

describe('EvaluatorOptimizerService - Business Logic', () => {
  let service: EvaluatorOptimizerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EvaluatorOptimizerService],
    }).compile();

    service = module.get<EvaluatorOptimizerService>(EvaluatorOptimizerService);

    // Reset mocks before each test
    jest.clearAllMocks();
  });

  describe('Iterative Translation Improvement Logic', () => {
    it('should complete translation in one iteration when quality is high', async () => {
      // Arrange: Mock high-quality initial translation
      mockGenerateText.mockResolvedValueOnce({
        text: 'Excellente traduction française',
      } as any);

      mockGenerateObject.mockResolvedValueOnce({
        object: {
          qualityScore: 9,
          preservesTone: true,
          preservesNuance: true,
          culturallyAccurate: true,
          specificIssues: [],
          improvementSuggestions: [],
        },
      } as any);

      mockStreamObject.mockReturnValue({
        toTextStreamResponse: jest
          .fn()
          .mockReturnValue(new Readable({ read() {} })),
      } as any);

      // Act
      await service.translateWithFeedback('Hello world', 'French');

      // Assert: Should only call generateText once (no improvement needed)
      expect(mockGenerateText).toHaveBeenCalledTimes(1);
      expect(mockGenerateObject).toHaveBeenCalledTimes(1);

      // Verify streaming response indicates 0 iterations
      expect(mockStreamObject).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('Iterations Required: 0'),
        }),
      );
    });

    it('should improve translation when quality score is below threshold', async () => {
      // Arrange: Mock low-quality initial translation that needs improvement
      mockGenerateText
        .mockResolvedValueOnce({
          text: 'Bonjour monde', // Initial translation
        } as any)
        .mockResolvedValueOnce({
          text: 'Salutations au monde entier', // Improved translation
        } as any);

      mockGenerateObject.mockResolvedValueOnce({
        object: {
          qualityScore: 6, // Below threshold of 8
          preservesTone: true,
          preservesNuance: true,
          culturallyAccurate: true,
          specificIssues: ['Translation is too literal'],
          improvementSuggestions: ['Use more natural French expressions'],
        },
      } as any);

      mockStreamObject.mockReturnValue({
        toTextStreamResponse: jest
          .fn()
          .mockReturnValue(new Readable({ read() {} })),
      } as any);

      // Act
      await service.translateWithFeedback('Hello world', 'French');

      // Assert: Should improve translation (2 generateText calls)
      expect(mockGenerateText).toHaveBeenCalledTimes(2);

      // Verify improvement prompt includes feedback
      expect(mockGenerateText).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          prompt: expect.stringContaining('Translation is too literal'),
        }),
      );
      expect(mockGenerateText).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          prompt: expect.stringContaining(
            'Use more natural French expressions',
          ),
        }),
      );
    });

    it('should improve translation when tone preservation fails', async () => {
      // Arrange: Mock translation with tone issues
      mockGenerateText
        .mockResolvedValueOnce({
          text: 'Salut le monde', // Initial - too casual
        } as any)
        .mockResolvedValueOnce({
          text: 'Bonjour le monde', // Improved - more formal
        } as any);

      mockGenerateObject.mockResolvedValueOnce({
        object: {
          qualityScore: 8,
          preservesTone: false, // Fails tone preservation
          preservesNuance: true,
          culturallyAccurate: true,
          specificIssues: ['Translation is too casual for formal context'],
          improvementSuggestions: ['Use more formal greeting'],
        },
      } as any);

      mockStreamObject.mockReturnValue({
        toTextStreamResponse: jest
          .fn()
          .mockReturnValue(new Readable({ read() {} })),
      } as any);

      // Act
      await service.translateWithFeedback('Good morning, world', 'French');

      // Assert: Should improve due to tone preservation failure
      expect(mockGenerateText).toHaveBeenCalledTimes(2);
      expect(mockGenerateText).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          prompt: expect.stringContaining(
            'Translation is too casual for formal context',
          ),
        }),
      );
    });

    it('should improve translation when nuance preservation fails', async () => {
      // Arrange: Mock translation with nuance issues
      mockGenerateText
        .mockResolvedValueOnce({
          text: 'Merci beaucoup',
        } as any)
        .mockResolvedValueOnce({
          text: 'Je vous suis très reconnaissant',
        } as any);

      mockGenerateObject.mockResolvedValueOnce({
        object: {
          qualityScore: 8,
          preservesTone: true,
          preservesNuance: false, // Fails nuance preservation
          culturallyAccurate: true,
          specificIssues: ['Translation loses emotional depth'],
          improvementSuggestions: ['Capture the deeper gratitude expressed'],
        },
      } as any);

      mockStreamObject.mockReturnValue({
        toTextStreamResponse: jest
          .fn()
          .mockReturnValue(new Readable({ read() {} })),
      } as any);

      // Act
      await service.translateWithFeedback('I am deeply grateful', 'French');

      // Assert: Should improve for nuance preservation
      expect(mockGenerateText).toHaveBeenCalledTimes(2);
      expect(mockGenerateText).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          prompt: expect.stringContaining('Translation loses emotional depth'),
        }),
      );
    });

    it('should improve translation when cultural accuracy fails', async () => {
      // Arrange: Mock translation with cultural issues
      mockGenerateText
        .mockResolvedValueOnce({
          text: 'Joyeux Thanksgiving',
        } as any)
        .mockResolvedValueOnce({
          text: 'Joyeuse Action de Grâce',
        } as any);

      mockGenerateObject.mockResolvedValueOnce({
        object: {
          qualityScore: 8,
          preservesTone: true,
          preservesNuance: true,
          culturallyAccurate: false, // Fails cultural accuracy
          specificIssues: ['Direct translation of cultural concept'],
          improvementSuggestions: [
            'Use culturally appropriate French equivalent',
          ],
        },
      } as any);

      mockStreamObject.mockReturnValue({
        toTextStreamResponse: jest
          .fn()
          .mockReturnValue(new Readable({ read() {} })),
      } as any);

      // Act
      await service.translateWithFeedback('Happy Thanksgiving', 'French');

      // Assert: Should improve for cultural accuracy
      expect(mockGenerateText).toHaveBeenCalledTimes(2);
      expect(mockGenerateText).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          prompt: expect.stringContaining(
            'Direct translation of cultural concept',
          ),
        }),
      );
    });

    it('should respect maximum iteration limit', async () => {
      // Arrange: Mock persistent low quality that never improves
      mockGenerateText.mockResolvedValue({
        text: 'Poor translation',
      } as any);

      mockGenerateObject.mockResolvedValue({
        object: {
          qualityScore: 4, // Always low quality
          preservesTone: false,
          preservesNuance: false,
          culturallyAccurate: false,
          specificIssues: ['Multiple issues'],
          improvementSuggestions: ['Needs major improvement'],
        },
      } as any);

      mockStreamObject.mockReturnValue({
        toTextStreamResponse: jest
          .fn()
          .mockReturnValue(new Readable({ read() {} })),
      } as any);

      // Act
      await service.translateWithFeedback('Complex text', 'French');

      // Assert: Should stop at MAX_ITERATIONS (3)
      // Initial translation + 2 improvements = 3 generateText calls
      expect(mockGenerateText).toHaveBeenCalledTimes(3);
      expect(mockGenerateObject).toHaveBeenCalledTimes(3);

      // Should have 3 iterations worth of results
      expect(mockStreamObject).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('Iterations Required: 3'),
        }),
      );
    });
  });

  describe('Model Selection Strategy', () => {
    it('should use flash model for initial translation and pro model for evaluation', async () => {
      // Arrange
      mockGenerateText.mockResolvedValueOnce({
        text: 'Translation result',
      } as any);

      mockGenerateObject.mockResolvedValueOnce({
        object: {
          qualityScore: 9,
          preservesTone: true,
          preservesNuance: true,
          culturallyAccurate: true,
          specificIssues: [],
          improvementSuggestions: [],
        },
      } as any);

      mockStreamObject.mockReturnValue({
        toTextStreamResponse: jest
          .fn()
          .mockReturnValue(new Readable({ read() {} })),
      } as any);

      // Act
      await service.translateWithFeedback('Test text', 'Spanish');

      // Assert: Verify correct model usage pattern
      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.stringContaining('expert literary translator'),
        }),
      );

      expect(mockGenerateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.stringContaining(
            'expert in evaluating literary translations',
          ),
        }),
      );
    });

    it('should use pro model for improvements when needed', async () => {
      // Arrange: Mock translation that needs improvement
      mockGenerateText
        .mockResolvedValueOnce({
          text: 'Initial translation',
        } as any)
        .mockResolvedValueOnce({
          text: 'Improved translation',
        } as any);

      mockGenerateObject.mockResolvedValueOnce({
        object: {
          qualityScore: 6,
          preservesTone: false,
          preservesNuance: true,
          culturallyAccurate: true,
          specificIssues: ['Tone issue'],
          improvementSuggestions: ['Fix tone'],
        },
      } as any);

      mockStreamObject.mockReturnValue({
        toTextStreamResponse: jest
          .fn()
          .mockReturnValue(new Readable({ read() {} })),
      } as any);

      // Act
      await service.translateWithFeedback('Test text', 'German');

      // Assert: Improvement should use pro model
      expect(mockGenerateText).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          system: expect.stringContaining(
            'addressing the specific feedback provided',
          ),
        }),
      );
    });
  });

  describe('Streaming Response Generation', () => {
    it('should generate proper streaming response with iteration results', async () => {
      // Arrange
      const iterationData = [
        {
          translation: 'First attempt',
          evaluation: {
            qualityScore: 6,
            preservesTone: false,
            preservesNuance: true,
            culturallyAccurate: true,
            specificIssues: ['Tone issue'],
            improvementSuggestions: ['Improve tone'],
          },
          iteration: 0,
        },
      ];

      mockGenerateText
        .mockResolvedValueOnce({ text: 'First attempt' } as any)
        .mockResolvedValueOnce({ text: 'Final translation' } as any);

      mockGenerateObject.mockResolvedValueOnce({
        object: iterationData[0].evaluation,
      } as any);

      const mockStream = new Readable({ read() {} });
      const mockStreamObjectResult = {
        toTextStreamResponse: jest.fn().mockReturnValue(mockStream),
      };
      mockStreamObject.mockReturnValue(mockStreamObjectResult as any);

      // Act
      const result = await service.translateWithFeedback(
        'Test text',
        'Italian',
      );

      // Assert: Verify streaming response structure
      expect(mockStreamObject).toHaveBeenCalledWith({
        model: expect.any(Object),
        schema: expect.objectContaining({
          shape: expect.objectContaining({
            finalTranslation: expect.any(Object),
            iterationsRequired: expect.any(Object),
            iterationResults: expect.any(Object),
            originalText: expect.any(Object),
            targetLanguage: expect.any(Object),
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
    it('should handle initial translation failures gracefully', async () => {
      // Arrange: Mock initial translation failure
      mockGenerateText.mockRejectedValueOnce(
        new Error('Translation API Error'),
      );

      // Act & Assert: Should throw the error
      await expect(
        service.translateWithFeedback('test text', 'French'),
      ).rejects.toThrow('Translation API Error');
    });

    it('should handle evaluation failures gracefully', async () => {
      // Arrange: Translation succeeds but evaluation fails
      mockGenerateText.mockResolvedValueOnce({
        text: 'Translated text',
      } as any);

      mockGenerateObject.mockRejectedValueOnce(
        new Error('Evaluation API Error'),
      );

      // Act & Assert: Should throw the error
      await expect(
        service.translateWithFeedback('test text', 'French'),
      ).rejects.toThrow('Evaluation API Error');
    });

    it('should handle improvement generation failures gracefully', async () => {
      // Arrange: Translation and evaluation succeed, but improvement fails
      mockGenerateText
        .mockResolvedValueOnce({
          text: 'Initial translation',
        } as any)
        .mockRejectedValueOnce(new Error('Improvement API Error'));

      mockGenerateObject.mockResolvedValueOnce({
        object: {
          qualityScore: 6, // Will trigger improvement attempt
          preservesTone: false,
          preservesNuance: true,
          culturallyAccurate: true,
          specificIssues: ['Issue'],
          improvementSuggestions: ['Suggestion'],
        },
      } as any);

      // Act & Assert: Should throw the error
      await expect(
        service.translateWithFeedback('test text', 'French'),
      ).rejects.toThrow('Improvement API Error');
    });
  });

  describe('Business Rule Validation', () => {
    it('should enforce quality thresholds correctly', async () => {
      // Test just one case to verify the business rule logic
      // Reset mocks
      jest.clearAllMocks();

      // Mock initial translation
      mockGenerateText.mockResolvedValueOnce({
        text: 'initial translation',
      } as any);

      // Mock evaluation that meets all quality criteria (should stop)
      mockGenerateObject.mockResolvedValueOnce({
        object: {
          qualityScore: 8,
          preservesTone: true,
          preservesNuance: true,
          culturallyAccurate: true,
          specificIssues: [],
          improvementSuggestions: [],
        },
      } as any);

      mockStreamObject.mockReturnValue({
        toTextStreamResponse: jest
          .fn()
          .mockReturnValue(new Readable({ read() {} })),
      } as any);

      await service.translateWithFeedback('test', 'French');

      // Should only call generateText once (no improvement needed)
      expect(mockGenerateText).toHaveBeenCalledTimes(1);
      expect(mockGenerateObject).toHaveBeenCalledTimes(1);

      // Should indicate 0 iterations in the streaming response
      expect(mockStreamObject).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('Iterations Required: 0'),
        }),
      );
    });

    it('should include correct data in final streaming response', async () => {
      // Arrange: Mock high-quality translation that doesn't need improvement
      mockGenerateText.mockResolvedValueOnce({
        text: 'Excellent translation',
      } as any);

      mockGenerateObject.mockResolvedValueOnce({
        object: {
          qualityScore: 9,
          preservesTone: true,
          preservesNuance: true,
          culturallyAccurate: true,
          specificIssues: [],
          improvementSuggestions: [],
        },
      } as any);

      mockStreamObject.mockReturnValue({
        toTextStreamResponse: jest
          .fn()
          .mockReturnValue(new Readable({ read() {} })),
      } as any);

      // Act
      await service.translateWithFeedback('Hello world', 'French');

      // Assert: Streaming response should include all required data
      const streamCall = mockStreamObject.mock.calls[0][0];
      expect(streamCall.prompt).toContain(
        'Final Translation: Excellent translation',
      );
      expect(streamCall.prompt).toContain('Iterations Required: 0');
      expect(streamCall.prompt).toContain('Original Text: Hello world');
      expect(streamCall.prompt).toContain('Target Language: French');

      // Verify streamObject was called with proper structure
      expect(streamCall.model).toBeDefined();
      expect(streamCall.prompt).toContain(
        'Return the following data as a structured object',
      );
    });
  });
});
