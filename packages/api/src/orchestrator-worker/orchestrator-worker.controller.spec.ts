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

  beforeEach(() => {
    const mockService = {
      implementFeature: vi.fn().mockResolvedValue(mockStream),
    } as unknown as OrchestratorWorkerService;

    // Manually inject the service to bypass DI issues
    controller = new OrchestratorWorkerController(mockService);
    service = mockService;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('implementFeature', () => {
    it('should implement feature and stream response', async () => {
      const featureRequest = 'Add user authentication with JWT tokens';
      const mockResponse = {
        setHeader: vi.fn(),
      } as any;

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
      } as any;

      await controller.implementFeature({ featureRequest }, mockResponse);

      expect(service.implementFeature).toHaveBeenCalledWith(featureRequest);
    });

    it('should handle simple feature request', async () => {
      const featureRequest = 'Add a dark mode toggle button';
      const mockResponse = {
        setHeader: vi.fn(),
      } as any;

      await controller.implementFeature({ featureRequest }, mockResponse);

      expect(service.implementFeature).toHaveBeenCalledWith(featureRequest);
    });

    it('should handle empty feature request', async () => {
      const featureRequest = '';
      const mockResponse = {
        setHeader: vi.fn(),
      } as any;

      await controller.implementFeature({ featureRequest }, mockResponse);

      expect(service.implementFeature).toHaveBeenCalledWith(featureRequest);
    });

    it('should handle service errors', async () => {
      const featureRequest = 'Add payment processing';
      (service.implementFeature as any).mockRejectedValue(
        new Error('Service error'),
      );

      const mockResponse = {
        setHeader: vi.fn(),
      } as any;

      await expect(
        controller.implementFeature({ featureRequest }, mockResponse),
      ).rejects.toThrow('Service error');
    });

    it('should handle database feature request', async () => {
      const featureRequest =
        'Add PostgreSQL database integration with migrations';
      const mockResponse = {
        setHeader: vi.fn(),
      } as any;

      await controller.implementFeature({ featureRequest }, mockResponse);

      expect(service.implementFeature).toHaveBeenCalledWith(featureRequest);
    });
  });
});
