# Evaluation Automation and Integration

This document describes the evaluation automation framework that enables systematic and automated quality assessment of all agent patterns.

## Overview

The automation framework provides:
- Automated test runner with configurable test suites
- API endpoint testing with streaming support
- Batch evaluation with parallel processing
- Scheduled evaluations with cron jobs
- Job queue management with Bull
- Rate limiting and quota management
- Result caching with Redis
- Performance monitoring and metrics
- Workflow orchestration

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Automation Controller                   │
├─────────────────────────────────────────────────────────┤
│  Test Runner │ Batch Processor │ Scheduler │ Workflow    │
├──────────────┴─────────────────┴───────────┴─────────────┤
│              Queue Manager (Bull + Redis)                 │
├───────────────────────────────────────────────────────────┤
│  Rate Limiter │ Retry Logic │ Cache │ Metrics Collector  │
├───────────────────────────────────────────────────────────┤
│                  Evaluation Services                      │
└───────────────────────────────────────────────────────────┘
```

## Components

### 1. Test Runner

The test runner executes evaluation test suites with support for:
- Sequential and parallel execution
- Configurable retry policies
- Test case filtering
- Real-time progress tracking

**Usage:**
```typescript
const testRun = await testRunner.run({
  suiteId: 'comprehensive',
  patterns: [AgentPattern.SEQUENTIAL_PROCESSING],
  parallel: true,
  dryRun: false,
});
```

### 2. Batch Processor

Handles large-scale evaluation jobs with:
- Parallel processing with concurrency control
- Error handling strategies (fail-fast, continue, retry)
- Progress tracking and notifications
- Resource limit management

**Usage:**
```typescript
const batchJob = await batchProcessor.createBatchJob(
  'Nightly Evaluation',
  [AgentPattern.SEQUENTIAL_PROCESSING, AgentPattern.ROUTING],
  ['comprehensive', 'regression'],
  {
    parallel: true,
    maxConcurrency: 5,
    errorHandling: ErrorHandlingStrategy.CONTINUE,
  }
);
```

### 3. Scheduler

Enables automated evaluation runs with:
- Cron-based scheduling
- Multiple schedule types (interval, daily, weekly, monthly)
- Timezone support
- Schedule history tracking

**Predefined Schedules:**
- **Daily Comprehensive**: Runs at 2 AM UTC
- **Hourly Quick Check**: Basic validation every hour
- **Weekly Regression**: Full regression suite on Sundays

### 4. Queue Management

Bull queue integration provides:
- Job prioritization (critical, high, normal, low)
- Retry with exponential backoff
- Dead letter queue for failed jobs
- Queue metrics and monitoring

**Queue Operations:**
```typescript
// Add job to queue
await queueService.addJob(
  JobType.BATCH_EVALUATION,
  { batchJobId: 'batch-123' },
  { priority: JobPriority.HIGH }
);

// Monitor queue
const metrics = await queueService.getQueueMetrics();
```

### 5. Rate Limiting

Protects API resources with:
- Multiple strategies (sliding window, token bucket)
- Quota management (hourly, daily, monthly)
- Pattern-specific limits
- Adaptive rate limiting

**Configuration:**
```typescript
const rateLimitConfig: RateLimitConfig = {
  windowMs: 60000,
  maxRequests: 100,
  maxTokens: 50000,
  strategy: RateLimitStrategy.SLIDING_WINDOW,
};
```

### 6. Caching

Redis-based caching for:
- Evaluation results
- API responses
- Test configurations
- Performance metrics

**Cache Operations:**
```typescript
// Check cache
const cached = await cacheService.getEvaluation(
  AgentPattern.SEQUENTIAL_PROCESSING,
  input
);

// Invalidate pattern cache
await cacheService.invalidatePattern(AgentPattern.ROUTING);
```

### 7. Performance Monitoring

Comprehensive metrics collection:
- Evaluation latency (avg, p95, p99)
- Token usage and costs
- Success/failure rates
- System resource usage
- Real-time alerts

**Metrics Access:**
```typescript
const metrics = await metricsService.getAggregatedMetrics(
  MetricPeriod.HOUR
);

const patternMetrics = await metricsService.getPatternMetrics(
  AgentPattern.SEQUENTIAL_PROCESSING
);
```

### 8. Workflow Orchestration

Complex evaluation workflows with:
- Multi-stage pipelines
- Conditional execution
- Parallel stages
- Approval gates
- Rollback support

**Example Workflow:**
```typescript
const workflow = {
  name: 'Release Validation',
  stages: [
    {
      id: 'health-check',
      type: StageType.API_TEST,
      config: { patterns: allPatterns },
    },
    {
      id: 'evaluation',
      type: StageType.BATCH,
      dependencies: ['health-check'],
      condition: { type: ConditionType.ON_SUCCESS },
    },
    {
      id: 'validation',
      type: StageType.VALIDATION,
      config: {
        validationRules: [{
          field: '$results.successRate',
          operator: 'greater-than',
          value: 0.95,
        }],
      },
    },
  ],
};
```

## API Endpoints

### Test Management
- `POST /automation/run` - Start test run
- `GET /automation/run/:runId` - Get test status
- `POST /automation/run/:runId/cancel` - Cancel test

### Batch Processing
- `POST /automation/batch` - Create batch job
- `GET /automation/batch` - List all batches
- `GET /automation/batch/:jobId` - Get batch status

### Scheduling
- `GET /automation/schedules` - List schedules
- `POST /automation/schedules` - Create schedule
- `POST /automation/schedules/:id/run` - Run now

### Queue Management
- `GET /automation/queue/metrics` - Queue statistics
- `POST /automation/queue/pause` - Pause processing
- `GET /automation/queue/dead-letter` - Failed jobs

### Metrics & Monitoring
- `GET /automation/metrics` - Aggregated metrics
- `GET /automation/metrics/alerts` - Active alerts
- `GET /automation/metrics/export` - Export data

## Configuration

### Environment Variables
```bash
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# API Configuration
API_BASE_URL=http://localhost:3001

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Cache Configuration
CACHE_TTL=3600
CACHE_MAX_SIZE=10000

# Queue Configuration
QUEUE_CONCURRENCY=5
QUEUE_MAX_RETRIES=3
```

### Test Suite Configuration
```typescript
interface TestSuiteConfig {
  parallel: boolean;
  maxConcurrency: number;
  retryAttempts: number;
  retryDelay: number;
  timeout: number;
  rateLimit: {
    maxRequestsPerMinute: number;
    maxTokensPerMinute: number;
  };
  cache: {
    enabled: boolean;
    ttl: number;
  };
}
```

## Best Practices

### 1. Test Organization
- Group related tests into suites
- Use descriptive test case names
- Tag tests for easy filtering
- Set appropriate timeouts

### 2. Performance Optimization
- Enable caching for repeated evaluations
- Use parallel execution for independent tests
- Configure appropriate rate limits
- Monitor token usage

### 3. Error Handling
- Configure retry policies based on error types
- Use circuit breakers for external dependencies
- Monitor dead letter queue
- Set up alerts for critical failures

### 4. Monitoring
- Track key metrics (latency, success rate, costs)
- Set up alerts for anomalies
- Export metrics for analysis
- Review performance trends

### 5. Scheduling
- Schedule intensive evaluations during off-peak hours
- Use quick checks for continuous validation
- Configure appropriate job priorities
- Monitor schedule execution history

## Troubleshooting

### Common Issues

**Queue Backing Up**
- Check rate limits and concurrent execution limits
- Review error rates and retry configuration
- Scale Redis or add more workers

**High Cache Miss Rate**
- Review cache key generation logic
- Check TTL configuration
- Verify cache invalidation strategy

**Evaluation Timeouts**
- Increase timeout values for complex evaluations
- Check API endpoint health
- Review network configuration

**Memory Issues**
- Configure result pagination
- Limit metric retention period
- Monitor Redis memory usage

### Debug Commands
```bash
# Check queue status
curl http://localhost:3001/automation/queue/metrics

# View recent failures
curl http://localhost:3001/automation/queue/dead-letter

# Export metrics for analysis
curl http://localhost:3001/automation/metrics/export?format=csv

# Check system health
curl http://localhost:3001/automation/metrics/system
```

## Integration Examples

### CI/CD Integration
```yaml
# GitHub Actions example
- name: Run Evaluation Suite
  run: |
    curl -X POST http://api/automation/batch \
      -H "Content-Type: application/json" \
      -d '{
        "name": "PR Validation",
        "patterns": ["all"],
        "testSuiteIds": ["quick"],
        "config": {
          "errorHandling": "fail-fast"
        }
      }'
```

### Monitoring Integration
```typescript
// Prometheus metrics export
app.get('/metrics', async (req, res) => {
  const metrics = await metricsService.getAggregatedMetrics(
    MetricPeriod.MINUTE
  );
  res.type('text/plain');
  res.send(formatPrometheusMetrics(metrics));
});
```

### Webhook Notifications
```typescript
// Configure workflow notifications
const workflow = {
  config: {
    notifications: {
      onFailure: true,
      channels: [{
        type: 'webhook',
        config: {
          url: 'https://hooks.slack.com/...',
          method: 'POST',
        },
      }],
    },
  },
};
```

## Future Enhancements

1. **Auto-scaling**: Dynamic worker scaling based on queue depth
2. **ML-based Optimization**: Predict optimal evaluation parameters
3. **Distributed Tracing**: End-to-end evaluation observability
4. **Cost Optimization**: Intelligent batching to reduce API costs
5. **A/B Testing**: Compare evaluation strategies
6. **Real-time Dashboard**: WebSocket-based monitoring UI