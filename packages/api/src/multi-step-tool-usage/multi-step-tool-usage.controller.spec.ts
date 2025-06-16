import { Test, TestingModule } from '@nestjs/testing';
import { MultiStepToolUsageController } from './multi-step-tool-usage.controller';
import { MultiStepToolUsageService } from './multi-step-tool-usage.service';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Response } from 'express';

describe('MultiStepToolUsageController', () => {
  let controller: MultiStepToolUsageController;
  let service: MultiStepToolUsageService;

  const mockStream = {
    pipe: vi.fn(),
  } as unknown as NodeJS.ReadableStream;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MultiStepToolUsageController],
      providers: [
        {
          provide: MultiStepToolUsageService,
          useValue: {
            solveMathProblem: vi.fn().mockResolvedValue(mockStream),
          },
        },
      ],
    }).compile();

    controller = module.get<MultiStepToolUsageController>(
      MultiStepToolUsageController,
    );
    service = module.get<MultiStepToolUsageService>(MultiStepToolUsageService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('solveMathProblem', () => {
    it('should solve math problem and stream response', async () => {
      const prompt = 'What is the area of a circle with radius 5?';
      const mockResponse = {
        setHeader: vi.fn(),
      } as unknown as Response;

      await controller.solveMathProblem({ prompt }, mockResponse);

      expect(service.solveMathProblem).toHaveBeenCalledWith(prompt);
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

    it('should handle complex math problem', async () => {
      const prompt = 'Calculate the derivative of x^3 + 2x^2 - 5x + 1';
      const mockResponse = {
        setHeader: vi.fn(),
      } as unknown as Response;

      await controller.solveMathProblem({ prompt }, mockResponse);

      expect(service.solveMathProblem).toHaveBeenCalledWith(prompt);
    });

    it('should handle word problem', async () => {
      const prompt =
        'If a train travels 120 miles in 2 hours, what is its average speed?';
      const mockResponse = {
        setHeader: vi.fn(),
      } as unknown as Response;

      await controller.solveMathProblem({ prompt }, mockResponse);

      expect(service.solveMathProblem).toHaveBeenCalledWith(prompt);
    });

    it('should handle algebraic equation', async () => {
      const prompt = 'Solve for x: 2x + 3 = 11';
      const mockResponse = {
        setHeader: vi.fn(),
      } as unknown as Response;

      await controller.solveMathProblem({ prompt }, mockResponse);

      expect(service.solveMathProblem).toHaveBeenCalledWith(prompt);
    });

    it('should handle empty prompt', async () => {
      const prompt = '';
      const mockResponse = {
        setHeader: vi.fn(),
      } as unknown as Response;

      await controller.solveMathProblem({ prompt }, mockResponse);

      expect(service.solveMathProblem).toHaveBeenCalledWith(prompt);
    });
  });
});
