import 'reflect-metadata';

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
  generateText: jest.fn().mockResolvedValue({ text: 'mock generated text' }),
  generateObject: jest.fn().mockResolvedValue({ 
    object: { 
      hasCallToAction: true,
      emotionalAppeal: 8,
      clarity: 9,
      mockKey: 'mockValue',
      routingDecision: 'customer_service',
      category: 'general',
      priority: 'medium',
      steps: [{ step: 'Mock step', description: 'Mock description' }],
      tasks: [{ task: 'Mock task', assignee: 'developer', priority: 'high' }]
    } 
  }),
  streamObject: jest.fn().mockReturnValue({
    toTextStreamResponse: jest.fn().mockReturnValue({
      // Mock a readable stream that can be piped
      pipe: jest.fn((res) => {
        // Immediately resolve with a mock response
        process.nextTick(() => {
          res.write('{"data": "mock stream response"}');
          res.end();
        });
        return res;
      }),
      // Add other stream methods that might be called
      on: jest.fn(),
      once: jest.fn(),
      emit: jest.fn(),
    }),
  }),
  tool: jest.fn(() => ({
    description: 'Mock tool',
    parameters: jest.fn(),
    execute: jest.fn().mockResolvedValue(42)
  })),
}));

// Mock mathjs for multi-step tool usage
jest.mock('mathjs', () => ({
  evaluate: jest.fn().mockReturnValue(42),
}));
