import { ParallelProcessingController } from './parallel-processing.controller';
import { ParallelProcessingService } from './parallel-processing.service';
import { Response } from 'express';

describe('ParallelProcessingController', () => {
  let controller: ParallelProcessingController;
  let service: ParallelProcessingService;

  const mockStream = {
    pipe: jest.fn(),
  } as unknown as NodeJS.ReadableStream;

  beforeEach(() => {
    const mockService = {
      parallelCodeReview: jest.fn().mockResolvedValue(mockStream),
    } as unknown as ParallelProcessingService;

    // Manually inject the service to bypass DI issues
    controller = new ParallelProcessingController(mockService);
    service = mockService;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('reviewCode', () => {
    it('should review code and stream response', async () => {
      const code = 'function add(a, b) { return a + b; }';
      const mockResponse = {
        setHeader: jest.fn(),
      } as any;

      await controller.reviewCode({ code }, mockResponse);

      expect(service.parallelCodeReview).toHaveBeenCalledWith(code);
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

    it('should handle complex code snippet', async () => {
      const code = `
        class UserService {
          constructor() {}
          async getUser(id) {
            return fetch('/api/users/' + id);
          }
        }
      `;
      const mockResponse = {
        setHeader: jest.fn(),
      } as any;

      await controller.reviewCode({ code }, mockResponse);

      expect(service.parallelCodeReview).toHaveBeenCalledWith(code);
    });

    it('should handle empty code', async () => {
      const code = '';
      const mockResponse = {
        setHeader: jest.fn(),
      } as any;

      await controller.reviewCode({ code }, mockResponse);

      expect(service.parallelCodeReview).toHaveBeenCalledWith(code);
    });

    it('should handle service errors', async () => {
      const code = 'function test() {}';
      (service.parallelCodeReview as any).mockRejectedValue(
        new Error('Service error'),
      );

      const mockResponse = {
        setHeader: jest.fn(),
      } as any;

      await expect(
        controller.reviewCode({ code }, mockResponse),
      ).rejects.toThrow('Service error');
    });

    it('should handle malformed code', async () => {
      const code = 'function broken() { return';
      const mockResponse = {
        setHeader: jest.fn(),
      } as any;

      await controller.reviewCode({ code }, mockResponse);

      expect(service.parallelCodeReview).toHaveBeenCalledWith(code);
    });
  });
});
