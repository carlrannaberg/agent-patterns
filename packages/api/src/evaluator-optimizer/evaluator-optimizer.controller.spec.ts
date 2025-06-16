import { Test, TestingModule } from '@nestjs/testing';
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EvaluatorOptimizerController],
      providers: [
        {
          provide: EvaluatorOptimizerService,
          useValue: {
            translateWithFeedback: vi.fn().mockResolvedValue(mockStream),
          },
        },
      ],
    }).compile();

    controller = module.get<EvaluatorOptimizerController>(
      EvaluatorOptimizerController,
    );
    service = module.get<EvaluatorOptimizerService>(EvaluatorOptimizerService);
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
      } as unknown as Response;

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
      } as unknown as Response;

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
      } as unknown as Response;

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
      } as unknown as Response;

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
