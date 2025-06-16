import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { RoutingModule } from '../src/routing/routing.module';

describe('RoutingController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [RoutingModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/routing (POST) should handle customer query', async () => {
    const inputData = { query: 'How do I return a product?' };

    const response = await request(app.getHttpServer())
      .post('/routing')
      .send(inputData);

    // The streaming endpoint should return 200 or 201
    // Both indicate the endpoint structure is correct
    expect([200, 201]).toContain(response.status);
    if (response.status === 200 || response.status === 201) {
      expect(response.headers['content-type']).toBe('application/json');
    }
  });

  it('/routing (POST) should handle technical query', async () => {
    const inputData = { query: 'My API is returning 500 errors' };

    const response = await request(app.getHttpServer())
      .post('/routing')
      .send(inputData);

    // The streaming endpoint should return 200 or 201
    expect([200, 201]).toContain(response.status);
    if (response.status === 200 || response.status === 201) {
      expect(response.headers['content-type']).toBe('application/json');
    }
  });

  it('/routing (POST) should handle missing query', async () => {
    const response = await request(app.getHttpServer())
      .post('/routing')
      .send({});

    // Should return 200 or 201 even with missing query - streaming endpoints handle this gracefully
    expect([200, 201]).toContain(response.status);
    if (response.status === 200 || response.status === 201) {
      expect(response.headers['content-type']).toBe('application/json');
    }
  });

  it('/routing (POST) should handle empty query', async () => {
    const inputData = { query: '' };

    const response = await request(app.getHttpServer())
      .post('/routing')
      .send(inputData);

    // The streaming endpoint should return 200 or 201
    expect([200, 201]).toContain(response.status);
    if (response.status === 200 || response.status === 201) {
      expect(response.headers['content-type']).toBe('application/json');
    }
  });
});
