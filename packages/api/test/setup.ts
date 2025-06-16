import 'reflect-metadata';
import { Readable } from 'stream';

// Mock the AI SDK for Jest
jest.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: jest.fn(() => {
    // Return a function that can be called with model names and returns a mock model
    const mockModel = jest.fn().mockReturnValue({
      toString: () => 'mock-model',
    });
    return mockModel;
  }),
}));

jest.mock('ai', () => ({
  generateText: jest.fn().mockResolvedValue({
    text: 'mock generated text',
    toolCalls: [
      {
        toolName: 'calculate',
        args: { expression: '2 + 2' },
      },
      {
        toolName: 'answer',
        args: {
          steps: [{ calculation: '2 + 2', reasoning: 'Simple addition' }],
          answer: '4',
        },
      },
    ],
    toolResults: [
      { result: '4', expression: '2 + 2' },
      {
        steps: [{ calculation: '2 + 2', reasoning: 'Simple addition' }],
        answer: '4',
      },
    ],
  }),
  generateObject: jest.fn().mockResolvedValue({
    object: {
      // Sequential processing properties
      hasCallToAction: true,
      emotionalAppeal: 8,
      clarity: 9,

      // Routing properties
      routingDecision: 'customer_service',
      category: 'general',
      priority: 'medium',

      // Orchestrator-worker properties
      files: [
        {
          purpose: 'Mock file purpose',
          filePath: '/mock/path.ts',
          changeType: 'create',
        },
      ],
      estimatedComplexity: 'medium',

      // Evaluator-optimizer properties
      translatedText: 'Mock translated text',
      qualityScore: 8,
      preservesTone: true,
      preservesNuance: true,
      culturallyAccurate: true,
      specificIssues: ['Mock specific issue 1', 'Mock specific issue 2'],
      improvementSuggestions: ['Mock improvement 1', 'Mock improvement 2'],
      feedbackPoints: ['Mock feedback point 1', 'Mock feedback point 2'],

      // Multi-step tool usage properties
      needsMathCalculation: true,
      mathExpression: '2 + 2',
      result: 42,

      // Parallel processing properties
      securityIssues: ['Mock security issue'],
      performanceIssues: ['Mock performance issue'],
      maintainabilityIssues: ['Mock maintainability issue'],
    },
  }),
  streamObject: jest.fn().mockReturnValue({
    toTextStreamResponse: jest.fn().mockReturnValue(
      // Return a proper Node.js Readable stream
      new Readable({
        read() {
          // Push mock JSON data and end the stream
          this.push('{"data": "mock stream response", "status": "complete"}');
          this.push(null); // End the stream
        },
      }),
    ),
  }),
  tool: jest.fn(() => ({
    description: 'Mock tool',
    parameters: jest.fn(),
    execute: jest.fn().mockResolvedValue(42),
  })),
}));

// Mock mathjs for multi-step tool usage
jest.mock('mathjs', () => ({
  evaluate: jest.fn().mockReturnValue(42),
}));
