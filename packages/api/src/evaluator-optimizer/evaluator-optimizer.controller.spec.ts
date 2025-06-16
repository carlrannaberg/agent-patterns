import { EvaluatorOptimizerController } from './evaluator-optimizer.controller';
import { EvaluatorOptimizerService } from './evaluator-optimizer.service';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Response } from 'express';

describe('EvaluatorOptimizerController', () => {
  let controller: EvaluatorOptimizerController;
  let service: EvaluatorOptimizerService;

  const mockStream = {
    pipe: vi.fn(),
  } as unknown as NodeJS.ReadableStream;

  beforeEach(() => {
    const mockService = {
      translateWithFeedback: vi.fn().mockResolvedValue(mockStream),
    } as unknown as EvaluatorOptimizerService;

    // Manually inject the service to bypass DI issues
    controller = new EvaluatorOptimizerController(mockService);
    service = mockService;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('translateWithFeedback', () => {
    it('should translate text and stream response', async () => {
      const text = 'Hello, how are you today?';
      const targetLanguage = 'Spanish';
      const mockResponse = {
        setHeader: vi.fn(),
      } as any;

      await controller.translateWithFeedback(
        { text, targetLanguage },
        mockResponse,
      );

      expect(service.translateWithFeedback).toHaveBeenCalledWith(
        text,
        targetLanguage,
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/json',
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'no-cache',
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Connection',
        'keep-alive',
      );
      expect(mockStream.pipe).toHaveBeenCalledWith(mockResponse);
    });

    it('should handle different target languages', async () => {
      const text = 'Good morning, beautiful weather today!';
      const targetLanguage = 'French';
      const mockResponse = {
        setHeader: vi.fn(),
      } as any;

      await controller.translateWithFeedback(
        { text, targetLanguage },
        mockResponse,
      );

      expect(service.translateWithFeedback).toHaveBeenCalledWith(
        text,
        targetLanguage,
      );
    });

    it('should handle complex text', async () => {
      const text =
        'The quick brown fox jumps over the lazy dog. This sentence contains every letter of the alphabet.';
      const targetLanguage = 'German';
      const mockResponse = {
        setHeader: vi.fn(),
      } as any;

      await controller.translateWithFeedback(
        { text, targetLanguage },
        mockResponse,
      );

      expect(service.translateWithFeedback).toHaveBeenCalledWith(
        text,
        targetLanguage,
      );
    });

    it('should handle empty text', async () => {
      const text = '';
      const targetLanguage = 'Italian';
      const mockResponse = {
        setHeader: vi.fn(),
      } as any;

      await controller.translateWithFeedback(
        { text, targetLanguage },
        mockResponse,
      );

      expect(service.translateWithFeedback).toHaveBeenCalledWith(
        text,
        targetLanguage,
      );
    });

    it('should handle service errors', async () => {
      const text = 'Test text';
      const targetLanguage = 'Spanish';
      (service.translateWithFeedback as any).mockRejectedValue(
        new Error('Service error'),
      );

      const mockResponse = {
        setHeader: vi.fn(),
      } as any;

      await expect(
        controller.translateWithFeedback(
          { text, targetLanguage },
          mockResponse,
        ),
      ).rejects.toThrow('Service error');
    });

    it('should handle technical text translation', async () => {
      const text =
        'Machine learning algorithms process large datasets to identify patterns.';
      const targetLanguage = 'Japanese';
      const mockResponse = {
        setHeader: vi.fn(),
      } as any;

      await controller.translateWithFeedback(
        { text, targetLanguage },
        mockResponse,
      );

      expect(service.translateWithFeedback).toHaveBeenCalledWith(
        text,
        targetLanguage,
      );
    });
  });
});
