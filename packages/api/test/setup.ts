import 'reflect-metadata';
import { vi } from 'vitest';

// Mock the AI SDK
vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: vi.fn(() => vi.fn(() => ({}))),
}));

vi.mock('ai', () => ({
  generateText: vi.fn().mockResolvedValue({ text: 'mock generated text' }),
  generateObject: vi
    .fn()
    .mockResolvedValue({ object: { mockKey: 'mockValue' } }),
  streamObject: vi.fn().mockReturnValue({
    toTextStreamResponse: vi.fn().mockReturnValue({
      pipe: vi.fn(),
    }),
  }),
}));
