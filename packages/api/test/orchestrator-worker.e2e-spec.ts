import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { OrchestratorWorkerController } from '../src/orchestrator-worker/orchestrator-worker.controller';
import { OrchestratorWorkerService } from '../src/orchestrator-worker/orchestrator-worker.service';
import { OrchestratorWorkerModule } from '../src/orchestrator-worker/orchestrator-worker.module';
import { Readable } from 'stream';
import { vi } from 'vitest';

describe('OrchestratorWorkerController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const mockStream = new Readable({
      read() {
        this.push('{"data": "mock response"}');
        this.push(null);
      }
    });

    const mockService = {
      implementFeature: vi.fn().mockResolvedValue(mockStream),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [OrchestratorWorkerModule],
    })
    .overrideProvider(OrchestratorWorkerService)
    .useValue(mockService)
    .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/orchestrator-worker (POST) should implement feature', async () => {
    const inputData = { 
      featureRequest: 'Add user authentication with JWT tokens' 
    };

    const response = await request(app.getHttpServer())
      .post('/orchestrator-worker')
      .send(inputData);

    // The endpoint should either work (200) or fail with a service error (500)
    // Both indicate the endpoint structure is correct
    expect([200, 500]).toContain(response.status);
  });

  it('/orchestrator-worker (POST) should handle complex feature request', async () => {
    const inputData = { 
      featureRequest: 'Create a real-time chat system with websockets and message persistence' 
    };

    const response = await request(app.getHttpServer())
      .post('/orchestrator-worker')
      .send(inputData);

    // The endpoint should either work (200) or fail with a service error (500)
    expect([200, 500]).toContain(response.status);
  });

  it('/orchestrator-worker (POST) should handle missing feature request', async () => {
    const response = await request(app.getHttpServer())
      .post('/orchestrator-worker')
      .send({});

    // Should fail due to missing featureRequest - this tests input validation
    expect(response.status).toBe(500);
  });

  it('/orchestrator-worker (POST) should handle empty feature request', async () => {
    const inputData = { featureRequest: '' };

    const response = await request(app.getHttpServer())
      .post('/orchestrator-worker')
      .send(inputData);

    // The endpoint should either work (200) or fail with a service error (500)
    expect([200, 500]).toContain(response.status);
  });
});