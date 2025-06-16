import { SequentialProcessingController } from './sequential-processing.controller';
import { SequentialProcessingService } from './sequential-processing.service';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('SequentialProcessingController', () => {
  let controller: SequentialProcessingController;
  let service: SequentialProcessingService;

  beforeEach(() => {
    const mockService = {
      generateMarketingCopy: vi.fn().mockResolvedValue({
        pipe: vi.fn(),
      }),
    } as unknown as SequentialProcessingService;

    // Manually inject the service to bypass DI issues
    controller = new SequentialProcessingController(mockService);
    service = mockService;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('generateMarketingCopy', () => {
    it('should call service and set proper headers', async () => {
      const input = 'AI-powered productivity app';
      const mockStream = { pipe: vi.fn() };
      (service.generateMarketingCopy as any).mockResolvedValue(mockStream);

      const mockResponse = {
        setHeader: vi.fn(),
      } as any;

      await controller.generateMarketingCopy({ input }, mockResponse);

      expect(service.generateMarketingCopy).toHaveBeenCalledWith(input);
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

    it('should handle empty input', async () => {
      const input = '';
      const mockStream = { pipe: vi.fn() };
      (service.generateMarketingCopy as any).mockResolvedValue(mockStream);

      const mockResponse = {
        setHeader: vi.fn(),
      } as any;

      await controller.generateMarketingCopy({ input }, mockResponse);

      expect(service.generateMarketingCopy).toHaveBeenCalledWith(input);
    });

    it('should handle service errors', async () => {
      const input = 'Test product';
      (service.generateMarketingCopy as any).mockRejectedValue(
        new Error('Service error'),
      );

      const mockResponse = {
        setHeader: vi.fn(),
      } as any;

      await expect(
        controller.generateMarketingCopy({ input }, mockResponse),
      ).rejects.toThrow('Service error');
    });
  });
});
