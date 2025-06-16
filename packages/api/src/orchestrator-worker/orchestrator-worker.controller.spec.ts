import { Test, TestingModule } from '@nestjs/testing';
import { OrchestratorWorkerController } from './orchestrator-worker.controller';
import { OrchestratorWorkerService } from './orchestrator-worker.service';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Response } from 'express';

describe('OrchestratorWorkerController', () => {
  let controller: OrchestratorWorkerController;
  let service: OrchestratorWorkerService;

  const mockStream = {
    pipe: vi.fn(),
  } as unknown as NodeJS.ReadableStream;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrchestratorWorkerController],
      providers: [
        {
          provide: OrchestratorWorkerService,
          useValue: {
            implementFeature: vi.fn().mockResolvedValue(mockStream),
          },
        },
      ],
    }).compile();

    controller = module.get<OrchestratorWorkerController>(
      OrchestratorWorkerController,
    );
    service = module.get<OrchestratorWorkerService>(OrchestratorWorkerService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('implementFeature', () => {
    it('should implement feature and stream response', async () => {
      const featureRequest = 'Add user authentication with JWT tokens';
      const mockResponse = {
        setHeader: vi.fn(),
      } as unknown as Response;

      await controller.implementFeature({ featureRequest }, mockResponse);

      expect(service.implementFeature).toHaveBeenCalledWith(featureRequest);
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

    it('should handle complex feature request', async () => {
      const featureRequest =
        'Implement real-time chat with WebSocket support and message persistence';
      const mockResponse = {
        setHeader: vi.fn(),
      } as unknown as Response;

      await controller.implementFeature({ featureRequest }, mockResponse);

      expect(service.implementFeature).toHaveBeenCalledWith(featureRequest);
    });

    it('should handle simple feature request', async () => {
      const featureRequest = 'Add a dark mode toggle button';
      const mockResponse = {
        setHeader: vi.fn(),
      } as unknown as Response;

      await controller.implementFeature({ featureRequest }, mockResponse);

      expect(service.implementFeature).toHaveBeenCalledWith(featureRequest);
    });

    it('should handle empty feature request', async () => {
      const featureRequest = '';
      const mockResponse = {
        setHeader: vi.fn(),
      } as unknown as Response;

      await controller.implementFeature({ featureRequest }, mockResponse);

      expect(service.implementFeature).toHaveBeenCalledWith(featureRequest);
    });
  });
});
