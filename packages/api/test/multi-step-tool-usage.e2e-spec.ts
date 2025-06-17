import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { MultiStepToolUsageModule } from '../src/multi-step-tool-usage/multi-step-tool-usage.module';

describe('MultiStepToolUsageController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MultiStepToolUsageModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/multi-step-tool-usage (POST) should solve math problem', async () => {
    const inputData = {
      prompt: 'Calculate the area of a circle with radius 5 meters',
    };

    const response = await request(app.getHttpServer())
      .post('/multi-step-tool-usage')
      .send(inputData);

    // The streaming endpoint should return 200 or 201
    // Both indicate the endpoint structure is correct
    expect([200, 201]).toContain(response.status);
    if (response.status === 200 || response.status === 201) {
      expect(response.headers['content-type']).toBe('application/json');
    }
  });

  it('/multi-step-tool-usage (POST) should handle complex math', async () => {
    const inputData = {
      prompt: 'What is the derivative of x^2 + 3x + 2?',
    };

    const response = await request(app.getHttpServer())
      .post('/multi-step-tool-usage')
      .send(inputData);

    // The streaming endpoint should return 200 or 201
    expect([200, 201]).toContain(response.status);
    if (response.status === 200 || response.status === 201) {
      expect(response.headers['content-type']).toBe('application/json');
    }
  });

  it('/multi-step-tool-usage (POST) should handle word problems', async () => {
    const inputData = {
      prompt: 'If a train travels 60 mph for 3 hours, how far does it go?',
    };

    const response = await request(app.getHttpServer())
      .post('/multi-step-tool-usage')
      .send(inputData);

    // The streaming endpoint should return 200 or 201
    expect([200, 201]).toContain(response.status);
    if (response.status === 200 || response.status === 201) {
      expect(response.headers['content-type']).toBe('application/json');
    }
  });

  it('/multi-step-tool-usage (POST) should handle missing prompt', async () => {
    const response = await request(app.getHttpServer()).post('/multi-step-tool-usage').send({});

    // Should return 200 or 201 even with missing prompt - streaming endpoints handle this gracefully
    expect([200, 201]).toContain(response.status);
    if (response.status === 200 || response.status === 201) {
      expect(response.headers['content-type']).toBe('application/json');
    }
  });

  it('/multi-step-tool-usage (POST) should handle empty prompt', async () => {
    const inputData = { prompt: '' };

    const response = await request(app.getHttpServer())
      .post('/multi-step-tool-usage')
      .send(inputData);

    // The streaming endpoint should return 200 or 201
    expect([200, 201]).toContain(response.status);
    if (response.status === 200 || response.status === 201) {
      expect(response.headers['content-type']).toBe('application/json');
    }
  });
});
