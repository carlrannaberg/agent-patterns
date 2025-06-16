import { RoutingController } from './routing.controller';
import { RoutingService } from './routing.service';
import { Response } from 'express';

describe('RoutingController', () => {
  let controller: RoutingController;
  let service: RoutingService;

  const mockStream = {
    pipe: jest.fn(),
  } as unknown as NodeJS.ReadableStream;

  beforeEach(() => {
    const mockService = {
      handleCustomerQuery: jest.fn().mockResolvedValue(mockStream),
    } as unknown as RoutingService;

    // Manually inject the service to bypass DI issues
    controller = new RoutingController(mockService);
    service = mockService;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('handleCustomerQuery', () => {
    it('should handle customer query and stream response', async () => {
      const query = 'How do I cancel my subscription?';
      const mockResponse = {
        setHeader: jest.fn(),
      } as any;

      await controller.handleCustomerQuery({ query }, mockResponse);

      expect(service.handleCustomerQuery).toHaveBeenCalledWith(query);
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

    it('should handle technical support query', async () => {
      const query = 'My app crashes when I click the export button';
      const mockResponse = {
        setHeader: jest.fn(),
      } as any;

      await controller.handleCustomerQuery({ query }, mockResponse);

      expect(service.handleCustomerQuery).toHaveBeenCalledWith(query);
    });

    it('should handle empty query', async () => {
      const query = '';
      const mockResponse = {
        setHeader: jest.fn(),
      } as any;

      await controller.handleCustomerQuery({ query }, mockResponse);

      expect(service.handleCustomerQuery).toHaveBeenCalledWith(query);
    });

    it('should handle service errors', async () => {
      const query = 'Test query';
      (service.handleCustomerQuery as any).mockRejectedValue(
        new Error('Service error'),
      );

      const mockResponse = {
        setHeader: jest.fn(),
      } as any;

      await expect(
        controller.handleCustomerQuery({ query }, mockResponse),
      ).rejects.toThrow('Service error');
    });

    it('should handle billing queries', async () => {
      const query = 'I was charged twice this month';
      const mockResponse = {
        setHeader: jest.fn(),
      } as any;

      await controller.handleCustomerQuery({ query }, mockResponse);

      expect(service.handleCustomerQuery).toHaveBeenCalledWith(query);
    });
  });
});
