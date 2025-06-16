import { MultiStepToolUsageController } from './multi-step-tool-usage.controller';
import { MultiStepToolUsageService } from './multi-step-tool-usage.service';
import { Response } from 'express';

describe('MultiStepToolUsageController', () => {
  let controller: MultiStepToolUsageController;
  let service: MultiStepToolUsageService;

  const mockStream = {
    pipe: jest.fn(),
  } as unknown as NodeJS.ReadableStream;

  beforeEach(() => {
    const mockService = {
      solveMathProblem: jest.fn().mockResolvedValue(mockStream),
    } as unknown as MultiStepToolUsageService;

    // Manually inject the service to bypass DI issues
    controller = new MultiStepToolUsageController(mockService);
    service = mockService;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('solveMathProblem', () => {
    it('should solve math problem and stream response', async () => {
      const prompt = 'What is the area of a circle with radius 5?';
      const mockResponse = {
        setHeader: jest.fn(),
      } as any;

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
        setHeader: jest.fn(),
      } as any;

      await controller.solveMathProblem({ prompt }, mockResponse);

      expect(service.solveMathProblem).toHaveBeenCalledWith(prompt);
    });

    it('should handle word problem', async () => {
      const prompt =
        'If a train travels 120 miles in 2 hours, what is its average speed?';
      const mockResponse = {
        setHeader: jest.fn(),
      } as any;

      await controller.solveMathProblem({ prompt }, mockResponse);

      expect(service.solveMathProblem).toHaveBeenCalledWith(prompt);
    });

    it('should handle algebraic equation', async () => {
      const prompt = 'Solve for x: 2x + 3 = 11';
      const mockResponse = {
        setHeader: jest.fn(),
      } as any;

      await controller.solveMathProblem({ prompt }, mockResponse);

      expect(service.solveMathProblem).toHaveBeenCalledWith(prompt);
    });

    it('should handle empty prompt', async () => {
      const prompt = '';
      const mockResponse = {
        setHeader: jest.fn(),
      } as any;

      await controller.solveMathProblem({ prompt }, mockResponse);

      expect(service.solveMathProblem).toHaveBeenCalledWith(prompt);
    });

    it('should handle service errors', async () => {
      const prompt = 'Calculate sqrt(-1)';
      (service.solveMathProblem as any).mockRejectedValue(
        new Error('Service error'),
      );

      const mockResponse = {
        setHeader: jest.fn(),
      } as any;

      await expect(
        controller.solveMathProblem({ prompt }, mockResponse),
      ).rejects.toThrow('Service error');
    });

    it('should handle statistics problem', async () => {
      const prompt =
        'Calculate the mean, median, and mode of: 1, 2, 3, 3, 4, 5, 5, 5, 6';
      const mockResponse = {
        setHeader: jest.fn(),
      } as any;

      await controller.solveMathProblem({ prompt }, mockResponse);

      expect(service.solveMathProblem).toHaveBeenCalledWith(prompt);
    });
  });
});
