import { Test, TestingModule } from '@nestjs/testing';
import { RoutingController } from './routing.controller';
import { RoutingService } from './routing.service';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Response } from 'express';

describe('RoutingController', () => {
  let controller: RoutingController;
  let service: RoutingService;

  const mockStream = {
    pipe: vi.fn(),
  } as unknown as NodeJS.ReadableStream;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RoutingController],
      providers: [
        {
          provide: RoutingService,
          useValue: {
            handleCustomerQuery: vi.fn().mockResolvedValue(mockStream),
          },
        },
      ],
    }).compile();

    controller = module.get<RoutingController>(RoutingController);
    service = module.get<RoutingService>(RoutingService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('handleCustomerQuery', () => {
    it('should handle customer query and stream response', async () => {
      const query = 'How do I cancel my subscription?';
      const mockResponse = {
        setHeader: vi.fn(),
      } as unknown as Response;

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
        setHeader: vi.fn(),
      } as unknown as Response;

      await controller.handleCustomerQuery({ query }, mockResponse);

      expect(service.handleCustomerQuery).toHaveBeenCalledWith(query);
    });

    it('should handle empty query', async () => {
      const query = '';
      const mockResponse = {
        setHeader: vi.fn(),
      } as unknown as Response;

      await controller.handleCustomerQuery({ query }, mockResponse);

      expect(service.handleCustomerQuery).toHaveBeenCalledWith(query);
    });
  });
});
