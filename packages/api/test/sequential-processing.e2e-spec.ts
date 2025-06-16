import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { SequentialProcessingController } from '../src/sequential-processing/sequential-processing.controller';
import { SequentialProcessingService } from '../src/sequential-processing/sequential-processing.service';
import { SequentialProcessingModule } from '../src/sequential-processing/sequential-processing.module';
import { Readable } from 'stream';
import { vi } from 'vitest';

describe('SequentialProcessingController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [SequentialProcessingModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/sequential-processing (POST) should accept requests with correct structure', async () => {
    const inputData = { input: 'eco-friendly water bottle' };

    const response = await request(app.getHttpServer())
      .post('/sequential-processing')
      .send(inputData);

    // Should return streaming response (200 or 201) with proper headers
    expect([200, 201]).toContain(response.status);
    expect(response.headers['content-type']).toBe('application/json');
  });

  it('/sequential-processing (POST) should handle missing input', async () => {
    const response = await request(app.getHttpServer())
      .post('/sequential-processing')
      .send({});

    // Should still work since the service doesn't validate input strictly
    expect([200, 201]).toContain(response.status);
  });

  it('/sequential-processing (POST) should accept empty input', async () => {
    const inputData = { input: '' };

    const response = await request(app.getHttpServer())
      .post('/sequential-processing')
      .send(inputData);

    // Should work with empty input
    expect([200, 201]).toContain(response.status);
    expect(response.headers['content-type']).toBe('application/json');
  });
});
