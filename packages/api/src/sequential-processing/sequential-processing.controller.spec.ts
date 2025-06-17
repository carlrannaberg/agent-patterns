import { SequentialProcessingController } from './sequential-processing.controller';
import { SequentialProcessingService } from './sequential-processing.service';

describe('SequentialProcessingController', () => {
  let controller: SequentialProcessingController;
  let service: SequentialProcessingService;

  beforeEach(() => {
    const mockService = {
      generateMarketingCopy: jest.fn().mockResolvedValue({
        pipeTextStreamToResponse: jest.fn(),
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
      const mockResult = { pipeTextStreamToResponse: jest.fn() };
      (service.generateMarketingCopy as any).mockResolvedValue(mockResult);

      const mockResponse = {
        setHeader: jest.fn(),
      } as any;

      await controller.generateMarketingCopy({ input }, mockResponse);

      expect(service.generateMarketingCopy).toHaveBeenCalledWith(input);
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');
      expect(mockResult.pipeTextStreamToResponse).toHaveBeenCalledWith(mockResponse);
    });

    it('should handle empty input', async () => {
      const input = '';
      const mockResult = { pipeTextStreamToResponse: jest.fn() };
      (service.generateMarketingCopy as any).mockResolvedValue(mockResult);

      const mockResponse = {
        setHeader: jest.fn(),
      } as any;

      await controller.generateMarketingCopy({ input }, mockResponse);

      expect(service.generateMarketingCopy).toHaveBeenCalledWith(input);
    });

    it('should handle service errors', async () => {
      const input = 'Test product';
      (service.generateMarketingCopy as any).mockRejectedValue(new Error('Service error'));

      const mockResponse = {
        setHeader: jest.fn(),
      } as any;

      await expect(controller.generateMarketingCopy({ input }, mockResponse)).rejects.toThrow(
        'Service error',
      );
    });
  });
});
