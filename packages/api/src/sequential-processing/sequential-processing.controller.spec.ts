import { SequentialProcessingController } from './sequential-processing.controller';
import { SequentialProcessingService } from './sequential-processing.service';

describe('SequentialProcessingController', () => {
  let controller: SequentialProcessingController;
  let service: SequentialProcessingService;

  beforeEach(() => {
    const mockService = {
      generateMarketingCopy: jest.fn().mockResolvedValue({
        pipe: jest.fn(),
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
      const mockStream = { pipe: jest.fn() };
      (service.generateMarketingCopy as any).mockResolvedValue(mockStream);

      const mockResponse = {
        setHeader: jest.fn(),
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
      const mockStream = { pipe: jest.fn() };
      (service.generateMarketingCopy as any).mockResolvedValue(mockStream);

      const mockResponse = {
        setHeader: jest.fn(),
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
        setHeader: jest.fn(),
      } as any;

      await expect(
        controller.generateMarketingCopy({ input }, mockResponse),
      ).rejects.toThrow('Service error');
    });
  });
});
