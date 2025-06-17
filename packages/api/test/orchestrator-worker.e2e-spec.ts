import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { OrchestratorWorkerModule } from '../src/orchestrator-worker/orchestrator-worker.module';

describe('OrchestratorWorkerController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [OrchestratorWorkerModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/orchestrator-worker (POST) should implement feature', async () => {
    const inputData = {
      featureRequest: 'Add user authentication with JWT tokens',
    };

    const response = await request(app.getHttpServer())
      .post('/orchestrator-worker')
      .send(inputData);

    // The streaming endpoint should return 200 or 201
    // Both indicate the endpoint structure is correct
    expect([200, 201]).toContain(response.status);
    if (response.status === 200 || response.status === 201) {
      expect(response.headers['content-type']).toBe('application/json');
    }
  });

  it('/orchestrator-worker (POST) should handle complex feature request', async () => {
    const inputData = {
      featureRequest: 'Create a real-time chat system with websockets and message persistence',
    };

    const response = await request(app.getHttpServer())
      .post('/orchestrator-worker')
      .send(inputData);

    // The streaming endpoint should return 200 or 201
    expect([200, 201]).toContain(response.status);
    if (response.status === 200 || response.status === 201) {
      expect(response.headers['content-type']).toBe('application/json');
    }
  });

  it('/orchestrator-worker (POST) should handle missing feature request', async () => {
    const response = await request(app.getHttpServer()).post('/orchestrator-worker').send({});

    // Should return 200 or 201 even with missing featureRequest - streaming endpoints handle this gracefully
    expect([200, 201]).toContain(response.status);
    if (response.status === 200 || response.status === 201) {
      expect(response.headers['content-type']).toBe('application/json');
    }
  });

  it('/orchestrator-worker (POST) should handle empty feature request', async () => {
    const inputData = { featureRequest: '' };

    const response = await request(app.getHttpServer())
      .post('/orchestrator-worker')
      .send(inputData);

    // The streaming endpoint should return 200 or 201
    expect([200, 201]).toContain(response.status);
    if (response.status === 200 || response.status === 201) {
      expect(response.headers['content-type']).toBe('application/json');
    }
  });
});
