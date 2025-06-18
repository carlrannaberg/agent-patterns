import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';

describe('Evaluation Reporting API (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );

    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/evaluation/reporting', () => {
    describe('GET /evaluation/reporting/results', () => {
      it('should return evaluation results with pagination', () => {
        return request(app.getHttpServer())
          .get('/evaluation/reporting/results')
          .query({
            patternType: 'sequential-processing',
            limit: 10,
            offset: 0,
          })
          .expect(200)
          .expect((res) => {
            expect(res.body).toHaveProperty('statusCode', 200);
            expect(res.body).toHaveProperty('data');
            expect(res.body).toHaveProperty('meta');
            expect(res.body.meta).toHaveProperty('total');
            expect(res.body.meta).toHaveProperty('limit', 10);
            expect(res.body.meta).toHaveProperty('offset', 0);
          });
      });

      it('should filter results by date range', () => {
        return request(app.getHttpServer())
          .get('/evaluation/reporting/results')
          .query({
            startDate: '2024-01-01T00:00:00Z',
            endDate: '2024-01-31T23:59:59Z',
          })
          .expect(200)
          .expect((res) => {
            expect(res.body.statusCode).toBe(200);
            expect(Array.isArray(res.body.data)).toBe(true);
          });
      });

      it('should validate query parameters', () => {
        return request(app.getHttpServer())
          .get('/evaluation/reporting/results')
          .query({
            minScore: 'invalid',
            maxScore: 'invalid',
          })
          .expect(400);
      });
    });

    describe('GET /evaluation/reporting/metrics/aggregate', () => {
      it('should return aggregated metrics', () => {
        return request(app.getHttpServer())
          .get('/evaluation/reporting/metrics/aggregate')
          .query({
            patternType: 'sequential-processing',
            startDate: '2024-01-01T00:00:00Z',
            endDate: '2024-01-31T23:59:59Z',
            groupBy: 'day',
          })
          .expect(200)
          .expect((res) => {
            expect(res.body.statusCode).toBe(200);
            expect(Array.isArray(res.body.data)).toBe(true);
          });
      });
    });

    describe('GET /evaluation/reporting/metrics/time-series', () => {
      it('should return time series metrics', () => {
        return request(app.getHttpServer())
          .get('/evaluation/reporting/metrics/time-series')
          .query({
            patternType: 'sequential-processing',
            metric: 'accuracy',
            startDate: '2024-01-01T00:00:00Z',
            endDate: '2024-01-31T23:59:59Z',
            interval: 'day',
          })
          .expect(200)
          .expect((res) => {
            expect(res.body.statusCode).toBe(200);
            expect(Array.isArray(res.body.data)).toBe(true);
          });
      });
    });

    describe('GET /evaluation/reporting/quality/baselines', () => {
      it('should return quality baselines', () => {
        return request(app.getHttpServer())
          .get('/evaluation/reporting/quality/baselines')
          .query({
            patternType: 'sequential-processing',
            periodType: 'weekly',
          })
          .expect(200)
          .expect((res) => {
            expect(res.body.statusCode).toBe(200);
            expect(Array.isArray(res.body.data)).toBe(true);
          });
      });
    });

    describe('GET /evaluation/reporting/quality/comparison', () => {
      it('should return pattern quality comparison', () => {
        return request(app.getHttpServer())
          .get('/evaluation/reporting/quality/comparison')
          .expect(200)
          .expect((res) => {
            expect(res.body.statusCode).toBe(200);
            expect(res.body).toHaveProperty('data');
          });
      });
    });

    describe('GET /evaluation/reporting/dashboard/summary', () => {
      it('should return dashboard summary', () => {
        return request(app.getHttpServer())
          .get('/evaluation/reporting/dashboard/summary')
          .query({ period: 'week' })
          .expect(200)
          .expect((res) => {
            expect(res.body.statusCode).toBe(200);
            expect(res.body.data).toHaveProperty('overview');
            expect(res.body.data).toHaveProperty('patternMetrics');
            expect(res.body.data).toHaveProperty('recentTrends');
            expect(res.body.data).toHaveProperty('activeAlerts');
          });
      });
    });

    describe('POST /evaluation/reporting/alerts/configure', () => {
      it('should create an alert configuration', () => {
        const alertDto = {
          name: 'Test Alert',
          description: 'Test alert for low accuracy',
          enabled: true,
          patternType: 'sequential-processing',
          metric: 'accuracy',
          condition: 'less_than',
          threshold: 0.7,
          notificationChannels: ['email'],
          recipients: ['test@example.com'],
        };

        return request(app.getHttpServer())
          .post('/evaluation/reporting/alerts/configure')
          .send(alertDto)
          .expect(201)
          .expect((res) => {
            expect(res.body.statusCode).toBe(201);
            expect(res.body.data).toHaveProperty('id');
            expect(res.body.data.name).toBe(alertDto.name);
          });
      });

      it('should validate alert configuration', () => {
        const invalidDto = {
          name: '',
          enabled: 'not-a-boolean',
          threshold: 'not-a-number',
        };

        return request(app.getHttpServer())
          .post('/evaluation/reporting/alerts/configure')
          .send(invalidDto)
          .expect(400);
      });
    });

    describe('POST /evaluation/reporting/reports/generate', () => {
      it('should generate a report', () => {
        const reportDto = {
          patternType: 'sequential-processing',
          reportType: 'summary',
          format: 'json',
          startDate: '2024-01-01T00:00:00Z',
          endDate: '2024-01-31T23:59:59Z',
        };

        return request(app.getHttpServer())
          .post('/evaluation/reporting/reports/generate')
          .send(reportDto)
          .expect(200)
          .expect((res) => {
            expect(res.body.statusCode).toBe(200);
            expect(res.body.data).toHaveProperty('reportId');
            expect(res.body.data).toHaveProperty('format', 'json');
          });
      });
    });

    describe('GET /evaluation/reporting/trends/analysis', () => {
      it('should return trend analysis', () => {
        return request(app.getHttpServer())
          .get('/evaluation/reporting/trends/analysis')
          .query({
            patternType: 'sequential-processing',
            metric: 'accuracy',
            period: 'month',
          })
          .expect(200)
          .expect((res) => {
            expect(res.body.statusCode).toBe(200);
            expect(res.body.data).toHaveProperty('trends');
          });
      });
    });

    describe('GET /evaluation/reporting/anomalies', () => {
      it('should detect anomalies', () => {
        return request(app.getHttpServer())
          .get('/evaluation/reporting/anomalies')
          .query({
            patternType: 'sequential-processing',
            metric: 'accuracy',
            threshold: 2.5,
          })
          .expect(200)
          .expect((res) => {
            expect(res.body.statusCode).toBe(200);
            expect(Array.isArray(res.body.data)).toBe(true);
          });
      });
    });

    describe('GET /evaluation/reporting/optimization/opportunities', () => {
      it('should return optimization opportunities', () => {
        return request(app.getHttpServer())
          .get('/evaluation/reporting/optimization/opportunities')
          .query({ patternType: 'sequential-processing' })
          .expect(200)
          .expect((res) => {
            expect(res.body.statusCode).toBe(200);
            expect(Array.isArray(res.body.data)).toBe(true);
          });
      });
    });
  });
});
