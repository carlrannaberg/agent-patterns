import { Test, TestingModule } from '@nestjs/testing';
import { ParallelProcessingController } from './parallel-processing.controller';
import { ParallelProcessingService } from './parallel-processing.service';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Response } from 'express';

describe('ParallelProcessingController', () => {
  let controller: ParallelProcessingController;
  let service: ParallelProcessingService;

  const mockStream = {
    pipe: vi.fn(),
  } as unknown as NodeJS.ReadableStream;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ParallelProcessingController],
      providers: [
        {
          provide: ParallelProcessingService,
          useValue: {
            parallelCodeReview: vi.fn().mockResolvedValue(mockStream),
          },
        },
      ],
    }).compile();

    controller = module.get<ParallelProcessingController>(
      ParallelProcessingController,
    );
    service = module.get<ParallelProcessingService>(ParallelProcessingService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('reviewCode', () => {
    it('should review code and stream response', async () => {
      const code = 'function add(a, b) { return a + b; }';
      const mockResponse = {
        setHeader: vi.fn(),
      } as unknown as Response;

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
        setHeader: vi.fn(),
      } as unknown as Response;

      await controller.reviewCode({ code }, mockResponse);

      expect(service.parallelCodeReview).toHaveBeenCalledWith(code);
    });

    it('should handle empty code', async () => {
      const code = '';
      const mockResponse = {
        setHeader: vi.fn(),
      } as unknown as Response;

      await controller.reviewCode({ code }, mockResponse);

      expect(service.parallelCodeReview).toHaveBeenCalledWith(code);
    });
  });
});
