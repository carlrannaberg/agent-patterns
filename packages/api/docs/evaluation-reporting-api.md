# Evaluation Reporting API Documentation

## Base URL
```
http://localhost:3001/evaluation/reporting
```

## API Endpoints

### 1. Evaluation Results

#### Get Evaluation Results
Retrieve evaluation results with filtering and pagination.

**Endpoint:** `GET /evaluation/reporting/results`

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| patternType | string | No | Filter by agent pattern type |
| testCaseId | string | No | Filter by test case ID |
| batchId | string | No | Filter by batch ID |
| startDate | ISO 8601 | No | Start date for filtering |
| endDate | ISO 8601 | No | End date for filtering |
| minScore | number | No | Minimum score (0-1) |
| maxScore | number | No | Maximum score (0-1) |
| success | boolean | No | Filter by success status |
| limit | number | No | Results per page (max: 1000, default: 100) |
| offset | number | No | Pagination offset |
| orderBy | string | No | Sort field: 'createdAt' or 'overallScore' |
| orderDirection | string | No | Sort direction: 'ASC' or 'DESC' |

**Response:**
```json
{
  "statusCode": 200,
  "data": [
    {
      "id": "uuid",
      "patternType": "sequential-processing",
      "testCaseId": "test-001",
      "overallScore": 0.85,
      "success": true,
      "executionTimeMs": 1234,
      "createdAt": "2024-01-15T10:30:00Z",
      "metrics": [
        {
          "name": "accuracy",
          "score": 0.9,
          "weight": 1.0,
          "feedback": "Good accuracy"
        }
      ]
    }
  ],
  "meta": {
    "total": 150,
    "limit": 100,
    "offset": 0
  }
}
```

#### Get Single Evaluation Result
Retrieve a specific evaluation result by ID.

**Endpoint:** `GET /evaluation/reporting/results/:id`

**Response:**
```json
{
  "statusCode": 200,
  "data": {
    "id": "uuid",
    "patternType": "sequential-processing",
    "testCaseId": "test-001",
    "input": {},
    "output": {},
    "overallScore": 0.85,
    "metadata": {},
    "success": true,
    "executionTimeMs": 1234,
    "llmMetadata": {
      "model": "gemini-2.5-pro",
      "promptTokens": 100,
      "completionTokens": 50,
      "totalTokens": 150
    },
    "createdAt": "2024-01-15T10:30:00Z",
    "metrics": []
  }
}
```

### 2. Batch Operations

#### Get Evaluation Batch
Retrieve a batch evaluation with all results.

**Endpoint:** `GET /evaluation/reporting/batches/:id`

**Response:**
```json
{
  "statusCode": 200,
  "data": {
    "id": "uuid",
    "patternType": "routing",
    "status": "completed",
    "totalTests": 50,
    "completedTests": 50,
    "failedTests": 2,
    "averageScore": 0.87,
    "summary": {
      "scoreDistribution": {},
      "metricAverages": {},
      "executionStats": {},
      "errorCategories": {}
    },
    "results": []
  }
}
```

### 3. Metrics and Aggregation

#### Get Aggregated Metrics
Retrieve aggregated metrics for a time period.

**Endpoint:** `GET /evaluation/reporting/metrics/aggregate`

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| patternType | string | Yes | Agent pattern type |
| startDate | ISO 8601 | Yes | Start date |
| endDate | ISO 8601 | Yes | End date |
| groupBy | string | No | Grouping: 'hour', 'day', 'week', 'month' |

**Response:**
```json
{
  "statusCode": 200,
  "data": [
    {
      "patternType": "parallel-processing",
      "metric": "accuracy",
      "period": "daily",
      "startDate": "2024-01-15",
      "endDate": "2024-01-16",
      "statistics": {
        "count": 100,
        "mean": 0.85,
        "median": 0.87,
        "stdDev": 0.1,
        "min": 0.6,
        "max": 0.98,
        "percentiles": {
          "p25": 0.78,
          "p50": 0.87,
          "p75": 0.92,
          "p90": 0.95,
          "p95": 0.97,
          "p99": 0.98
        }
      },
      "trend": {
        "direction": "improving",
        "changePercent": 5.2,
        "slope": 0.74
      }
    }
  ]
}
```

#### Get Time Series Metrics
Retrieve metrics as time series data.

**Endpoint:** `GET /evaluation/reporting/metrics/time-series`

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| patternType | string | Yes | Agent pattern type |
| metric | string | Yes | Metric name |
| startDate | ISO 8601 | Yes | Start date |
| endDate | ISO 8601 | Yes | End date |
| interval | string | No | Time interval: 'hour', 'day', 'week' |

**Response:**
```json
{
  "statusCode": 200,
  "data": [
    {
      "period": "2024-01-15T00:00:00Z",
      "avgScore": 0.85,
      "minScore": 0.72,
      "maxScore": 0.95,
      "count": 45,
      "stdDev": 0.08
    }
  ]
}
```

### 4. Quality Analysis

#### Get Quality Baselines
Retrieve quality baseline metrics.

**Endpoint:** `GET /evaluation/reporting/quality/baselines`

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| patternType | string | No | Filter by pattern type |
| metric | string | No | Filter by metric name |
| periodType | string | No | Period: 'daily', 'weekly', 'monthly', 'all_time' |

**Response:**
```json
{
  "statusCode": 200,
  "data": [
    {
      "id": "uuid",
      "patternType": "orchestrator-worker",
      "metricName": "completeness",
      "periodType": "weekly",
      "mean": 0.88,
      "median": 0.9,
      "stdDeviation": 0.05,
      "thresholds": {
        "excellent": 0.95,
        "good": 0.85,
        "acceptable": 0.75,
        "poor": 0.6
      },
      "trendData": {
        "direction": "stable",
        "changePercent": 1.2
      }
    }
  ]
}
```

#### Compare Pattern Quality
Compare quality metrics across all patterns.

**Endpoint:** `GET /evaluation/reporting/quality/comparison`

**Response:**
```json
{
  "statusCode": 200,
  "data": [
    {
      "patternType": "sequential-processing",
      "weeklyAverage": 0.92,
      "weeklyMedian": 0.93,
      "standardDeviation": 0.04,
      "qualityRating": "Excellent",
      "trend": "improving",
      "percentileRanks": {
        "p25": 0.89,
        "p50": 0.93,
        "p75": 0.95,
        "p90": 0.97
      }
    }
  ]
}
```

### 5. Failure Analysis

#### Get Failure Patterns
Retrieve categorized failure patterns.

**Endpoint:** `GET /evaluation/reporting/failures/patterns`

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| patternType | string | No | Filter by pattern type |
| status | string | No | Status: 'active', 'resolved', 'monitoring' |

**Response:**
```json
{
  "statusCode": 200,
  "data": [
    {
      "id": "uuid",
      "patternType": "multi-step-tool-usage",
      "category": "timeout",
      "description": "Timeout errors in calculation steps",
      "occurrenceCount": 23,
      "impactScore": 0.78,
      "status": "active",
      "commonFactors": {},
      "rootCauseAnalysis": {
        "identifiedCause": "Performance/timeout issue",
        "confidence": 0.85,
        "evidence": [],
        "suggestedFixes": []
      }
    }
  ]
}
```

#### Get Failure Analysis
Get detailed analysis for a specific failure pattern.

**Endpoint:** `GET /evaluation/reporting/failures/analysis/:id`

**Response:**
```json
{
  "statusCode": 200,
  "data": {
    "pattern": {},
    "similarFailures": [],
    "rootCauseHypotheses": [
      {
        "cause": "API rate limiting",
        "confidence": 0.9,
        "evidence": ["Error signature shows rate limit exceeded"]
      }
    ],
    "suggestedRemediations": [
      {
        "action": "Implement exponential backoff",
        "priority": "high",
        "estimatedEffort": "medium"
      }
    ]
  }
}
```

### 6. Anomaly Detection

#### Detect Anomalies
Detect anomalous evaluation results.

**Endpoint:** `GET /evaluation/reporting/anomalies`

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| patternType | string | Yes | Agent pattern type |
| metric | string | Yes | Metric to analyze |
| threshold | number | No | Z-score threshold (default: 2.5) |

**Response:**
```json
{
  "statusCode": 200,
  "data": [
    {
      "id": "uuid",
      "patternType": "routing",
      "overallScore": 0.23,
      "createdAt": "2024-01-15T14:30:00Z",
      "metrics": []
    }
  ]
}
```

### 7. Optimization

#### Get Optimization Opportunities
Identify areas for improvement.

**Endpoint:** `GET /evaluation/reporting/optimization/opportunities`

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| patternType | string | No | Filter by pattern type |

**Response:**
```json
{
  "statusCode": 200,
  "data": [
    {
      "patternType": "evaluator-optimizer",
      "metric": "accuracy",
      "currentScore": 0.68,
      "potentialImprovement": 0.22,
      "recommendations": [
        "Review and improve prompt engineering",
        "Consider using more specific evaluation criteria"
      ],
      "estimatedImpact": "high",
      "implementationComplexity": "medium"
    }
  ]
}
```

### 8. Alerting

#### Create Alert Configuration
Configure a new alert.

**Endpoint:** `POST /evaluation/reporting/alerts/configure`

**Request Body:**
```json
{
  "name": "Low Accuracy Alert",
  "description": "Triggers when accuracy drops below 70%",
  "patternType": "sequential-processing",
  "alertType": "score_degradation",
  "conditions": {
    "metric": "accuracy",
    "operator": "lt",
    "threshold": 0.7,
    "windowSize": 60,
    "windowUnit": "minutes"
  },
  "notificationChannels": [
    {
      "type": "log",
      "config": {}
    }
  ],
  "enabled": true,
  "severity": "high",
  "cooldownMinutes": 60
}
```

**Response:**
```json
{
  "statusCode": 201,
  "data": {
    "id": "uuid",
    "name": "Low Accuracy Alert",
    "enabled": true
  }
}
```

#### Get Alert Configurations
Retrieve configured alerts.

**Endpoint:** `GET /evaluation/reporting/alerts/configurations`

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| enabled | boolean | No | Filter by enabled status |
| patternType | string | No | Filter by pattern type |

#### Get Alert History
Retrieve alert trigger history.

**Endpoint:** `GET /evaluation/reporting/alerts/history`

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| configurationId | string | No | Filter by configuration |
| status | string | No | Status filter |
| startDate | ISO 8601 | No | Start date |
| endDate | ISO 8601 | No | End date |

### 9. Reports

#### Generate Report
Generate a comprehensive report.

**Endpoint:** `POST /evaluation/reporting/reports/generate`

**Request Body:**
```json
{
  "reportType": "detailed",
  "format": "pdf",
  "patternType": "routing",
  "startDate": "2024-01-01",
  "endDate": "2024-01-31",
  "metrics": ["accuracy", "completeness"],
  "customOptions": {}
}
```

**Response (JSON format):**
```json
{
  "statusCode": 200,
  "data": {
    "format": "json",
    "content": {},
    "filename": "report-1234567890.json"
  }
}
```

**Response (PDF/CSV format):**
Returns binary data with appropriate content-type headers.

#### Get Report Templates
Get available report templates.

**Endpoint:** `GET /evaluation/reporting/reports/templates`

**Response:**
```json
{
  "statusCode": 200,
  "data": [
    {
      "id": "summary",
      "name": "Executive Summary",
      "description": "High-level overview of evaluation performance",
      "supportedFormats": ["pdf", "json"]
    }
  ]
}
```

### 10. Dashboard

#### Get Dashboard Summary
Get summary data for dashboard display.

**Endpoint:** `GET /evaluation/reporting/dashboard/summary`

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| period | string | No | Period: 'day', 'week', 'month' (default: 'week') |

**Response:**
```json
{
  "statusCode": 200,
  "data": {
    "period": "Last week",
    "totalEvaluations": 1250,
    "averageScore": 0.86,
    "successRate": 94.5,
    "patternPerformance": [],
    "topPerformingMetrics": [],
    "recentFailures": [],
    "systemHealth": {
      "status": "healthy",
      "alerts": 0,
      "avgResponseTime": 1234
    }
  }
}
```

#### Get Trend Analysis
Analyze trends over time.

**Endpoint:** `GET /evaluation/reporting/trends/analysis`

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| patternType | string | No | Filter by pattern type |
| metric | string | No | Specific metric to analyze |
| period | string | No | Analysis period: 'week', 'month', 'quarter' |

**Response:**
```json
{
  "statusCode": 200,
  "data": {
    "period": "month",
    "dataPoints": [],
    "trend": "improving",
    "volatility": 0.05,
    "forecast": {
      "confidence": "medium",
      "nextPeriodEstimate": 0.89,
      "trendBased": true
    }
  }
}
```

## Error Responses

All endpoints return consistent error responses:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Validation failed",
  "details": []
}
```

Common HTTP status codes:
- 200: Success
- 201: Created
- 400: Bad Request
- 404: Not Found
- 500: Internal Server Error

## Rate Limiting

API endpoints are cached with appropriate TTL values:
- Result queries: 5 minutes
- Individual results: 10 minutes
- Templates and configurations: 1 hour

## Best Practices

1. **Pagination**: Always use pagination for large result sets
2. **Date Filtering**: Use date ranges to limit query scope
3. **Caching**: Leverage HTTP caching headers
4. **Batch Operations**: Use batch endpoints for bulk operations
5. **Monitoring**: Set up alerts for critical metrics