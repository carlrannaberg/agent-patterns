import 'reflect-metadata';
import { vi } from 'vitest';

// Mock the AI SDK
vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: vi.fn(() => {
    // Return a function that can be called with model names
    return vi.fn(() => 'mock-model');
  }),
}));

vi.mock('ai', () => ({
  generateText: vi.fn().mockResolvedValue({ text: 'mock generated text' }),
  generateObject: vi.fn().mockResolvedValue({ 
    object: { 
      hasCallToAction: true,
      emotionalAppeal: 8,
      clarity: 9,
      mockKey: 'mockValue' 
    } 
  }),
  streamObject: vi.fn().mockReturnValue({
    toTextStreamResponse: vi.fn().mockReturnValue({
      pipe: vi.fn((res) => {
        // Simulate a successful streaming response
        res.status = vi.fn().mockReturnValue(res);
        res.json = vi.fn().mockReturnValue(res);
        res.end = vi.fn();
        setTimeout(() => {
          if (res.end) res.end();
        }, 10);
        return res;
      }),
    }),
  }),
}));

// Mock mathjs for multi-step tool usage
vi.mock('mathjs', () => ({
  evaluate: vi.fn().mockReturnValue(42),
}));
