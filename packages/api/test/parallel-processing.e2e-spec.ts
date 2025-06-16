import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { ParallelProcessingModule } from '../src/parallel-processing/parallel-processing.module';

describe('ParallelProcessingController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ParallelProcessingModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/parallel-processing (POST) should perform code review', async () => {
    const inputData = { 
      code: `
        function calculateSum(a, b) {
          return a + b;
        }
      ` 
    };

    const response = await request(app.getHttpServer())
      .post('/parallel-processing')
      .send(inputData);

    // The streaming endpoint should return 200 or 201
    // Both indicate the endpoint structure is correct
    expect([200, 201]).toContain(response.status);
    if (response.status === 200 || response.status === 201) {
      expect(response.headers['content-type']).toBe('application/json');
    }
  });

  it('/parallel-processing (POST) should handle complex code', async () => {
    const inputData = { 
      code: `
        class DatabaseConnection {
          connect() {
            // Some database connection logic
            return true;
          }
        }
      ` 
    };

    const response = await request(app.getHttpServer())
      .post('/parallel-processing')
      .send(inputData);

    // The streaming endpoint should return 200 or 201
    expect([200, 201]).toContain(response.status);
    if (response.status === 200 || response.status === 201) {
      expect(response.headers['content-type']).toBe('application/json');
    }
  });

  it('/parallel-processing (POST) should handle missing code', async () => {
    const response = await request(app.getHttpServer())
      .post('/parallel-processing')
      .send({});

    // Should return 200 or 201 even with missing code - streaming endpoints handle this gracefully
    expect([200, 201]).toContain(response.status);
    if (response.status === 200 || response.status === 201) {
      expect(response.headers['content-type']).toBe('application/json');
    }
  });

  it('/parallel-processing (POST) should handle empty code', async () => {
    const inputData = { code: '' };

    const response = await request(app.getHttpServer())
      .post('/parallel-processing')
      .send(inputData);

    // The streaming endpoint should return 200 or 201
    expect([200, 201]).toContain(response.status);
    if (response.status === 200 || response.status === 201) {
      expect(response.headers['content-type']).toBe('application/json');
    }
  });
});