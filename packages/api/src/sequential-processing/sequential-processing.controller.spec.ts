import { Test, TestingModule } from '@nestjs/testing';
import { SequentialProcessingController } from './sequential-processing.controller';
import { SequentialProcessingService } from './sequential-processing.service';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('SequentialProcessingController', () => {
  let controller: SequentialProcessingController;
  let mockService: any;

  beforeEach(async () => {
    mockService = {
      generateMarketingCopy: vi.fn().mockResolvedValue({
        pipe: vi.fn(),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SequentialProcessingController],
      providers: [
        {
          provide: SequentialProcessingService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<SequentialProcessingController>(
      SequentialProcessingController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('generateMarketingCopy', () => {
    it('should call service and set proper headers', async () => {
      const input = 'AI-powered productivity app';
      const mockResponse = {
        setHeader: vi.fn(),
      };

      await controller.generateMarketingCopy({ input }, mockResponse as any);

      expect(mockService.generateMarketingCopy).toHaveBeenCalledWith(input);
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
    });

    it('should handle empty input', async () => {
      const input = '';
      const mockResponse = {
        setHeader: vi.fn(),
      };

      await controller.generateMarketingCopy({ input }, mockResponse as any);

      expect(mockService.generateMarketingCopy).toHaveBeenCalledWith(input);
    });
  });
});
