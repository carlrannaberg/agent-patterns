# Evaluation Reporting Database Schema

## Overview
The evaluation reporting system uses PostgreSQL with TypeORM for data persistence. The schema is designed to support comprehensive evaluation tracking, aggregation, and reporting capabilities.

## Entity Relationship Diagram

```
EvaluationBatch (1) -----> (*) EvaluationResult
                                      |
                                      v
                              (*) MetricScore

QualityBaseline (standalone)
FailurePattern (standalone)
AlertConfiguration (1) -----> (*) AlertHistory
```

## Database Entities

### 1. EvaluationResult
Stores individual evaluation results with comprehensive metrics.

**Table:** `evaluation_results`

| Column | Type | Description | Indexes |
|--------|------|-------------|---------|
| id | UUID | Primary key | PK |
| pattern_type | VARCHAR | Agent pattern type | IDX |
| test_case_id | VARCHAR | Reference to test case | IDX |
| input | JSONB | Input data for evaluation | - |
| output | JSONB | Output from evaluation | - |
| overall_score | FLOAT | Overall evaluation score (0-1) | IDX |
| metadata | JSONB | Additional metadata | - |
| error | TEXT | Error message if failed | - |
| success | BOOLEAN | Success status | - |
| execution_time_ms | FLOAT | Execution time in milliseconds | - |
| llm_metadata | JSONB | LLM usage statistics | - |
| evaluation_method | VARCHAR | Method used for evaluation | - |
| evaluator_config | JSONB | Configuration used | - |
| batch_id | UUID | Reference to batch | FK |
| created_at | TIMESTAMP | Creation timestamp | IDX |
| updated_at | TIMESTAMP | Update timestamp | - |

**Composite Indexes:**
- `(pattern_type, created_at)`
- `(test_case_id, created_at)`

### 2. MetricScore
Individual metric scores for each evaluation.

**Table:** `metric_scores`

| Column | Type | Description | Indexes |
|--------|------|-------------|---------|
| id | UUID | Primary key | PK |
| name | VARCHAR | Metric name | IDX |
| score | FLOAT | Metric score (0-1) | - |
| weight | FLOAT | Metric weight | - |
| feedback | TEXT | Detailed feedback | - |
| details | JSONB | Additional details | - |
| evaluation_result_id | UUID | Parent evaluation | FK |
| created_at | TIMESTAMP | Creation timestamp | - |

**Composite Indexes:**
- `(evaluation_result_id, name)`
- `(name, score)`

### 3. EvaluationBatch
Groups multiple evaluations together for batch processing.

**Table:** `evaluation_batches`

| Column | Type | Description | Indexes |
|--------|------|-------------|---------|
| id | UUID | Primary key | PK |
| pattern_type | VARCHAR | Agent pattern type | IDX |
| status | ENUM | pending/running/completed/failed | IDX |
| total_tests | INTEGER | Total number of tests | - |
| completed_tests | INTEGER | Completed test count | - |
| failed_tests | INTEGER | Failed test count | - |
| average_score | FLOAT | Average score across batch | - |
| summary | JSONB | Batch summary statistics | - |
| configuration | JSONB | Batch configuration | - |
| description | TEXT | Batch description | - |
| started_at | TIMESTAMP | Start timestamp | - |
| completed_at | TIMESTAMP | Completion timestamp | - |
| created_at | TIMESTAMP | Creation timestamp | IDX |
| updated_at | TIMESTAMP | Update timestamp | - |

**Composite Indexes:**
- `(pattern_type, created_at)`
- `(status, created_at)`

### 4. QualityBaseline
Stores baseline quality metrics for comparison.

**Table:** `quality_baselines`

| Column | Type | Description | Indexes |
|--------|------|-------------|---------|
| id | UUID | Primary key | PK |
| pattern_type | VARCHAR | Agent pattern type | IDX |
| metric_name | VARCHAR | Metric name | IDX |
| period_type | ENUM | daily/weekly/monthly/all_time | IDX |
| mean | FLOAT | Mean value | - |
| median | FLOAT | Median value | - |
| std_deviation | FLOAT | Standard deviation | - |
| min | FLOAT | Minimum value | - |
| max | FLOAT | Maximum value | - |
| p25 | FLOAT | 25th percentile | - |
| p75 | FLOAT | 75th percentile | - |
| p90 | FLOAT | 90th percentile | - |
| p95 | FLOAT | 95th percentile | - |
| p99 | FLOAT | 99th percentile | - |
| sample_count | INTEGER | Number of samples | - |
| thresholds | JSONB | Quality thresholds | - |
| trend_data | JSONB | Trend information | - |
| calculated_at | TIMESTAMP | Calculation timestamp | - |
| created_at | TIMESTAMP | Creation timestamp | - |
| updated_at | TIMESTAMP | Update timestamp | IDX |

**Composite Indexes:**
- `(pattern_type, metric_name, period_type)`

### 5. FailurePattern
Tracks and categorizes failure patterns.

**Table:** `failure_patterns`

| Column | Type | Description | Indexes |
|--------|------|-------------|---------|
| id | UUID | Primary key | PK |
| pattern_type | VARCHAR | Agent pattern type | IDX |
| category | VARCHAR | Error category | IDX |
| sub_category | VARCHAR | Error sub-category | - |
| description | TEXT | Pattern description | - |
| error_signature | VARCHAR | Normalized error signature | IDX |
| occurrence_count | INTEGER | Number of occurrences | - |
| example_cases | JSONB | Example failure cases | - |
| common_factors | JSONB | Common factors analysis | - |
| root_cause_analysis | JSONB | Root cause analysis | - |
| impact_score | FLOAT | Impact score (0-1) | IDX |
| status | ENUM | active/resolved/monitoring | IDX |
| first_seen | TIMESTAMP | First occurrence | - |
| last_seen | TIMESTAMP | Last occurrence | IDX |
| resolved_at | TIMESTAMP | Resolution timestamp | - |
| created_at | TIMESTAMP | Creation timestamp | - |
| updated_at | TIMESTAMP | Update timestamp | - |

**Composite Indexes:**
- `(pattern_type, status)`
- `(category, impact_score)`

### 6. AlertConfiguration
Configuration for monitoring alerts.

**Table:** `alert_configurations`

| Column | Type | Description | Indexes |
|--------|------|-------------|---------|
| id | UUID | Primary key | PK |
| name | VARCHAR | Alert name | UNIQUE |
| description | TEXT | Alert description | - |
| pattern_type | VARCHAR | Agent pattern type | IDX |
| alert_type | ENUM | Type of alert | IDX |
| conditions | JSONB | Alert conditions | - |
| notification_channels | JSONB | Notification config | - |
| enabled | BOOLEAN | Is alert enabled | IDX |
| severity | ENUM | low/medium/high/critical | - |
| cooldown_minutes | INTEGER | Cooldown period | - |
| created_at | TIMESTAMP | Creation timestamp | IDX |
| updated_at | TIMESTAMP | Update timestamp | - |

### 7. AlertHistory
History of triggered alerts.

**Table:** `alert_history`

| Column | Type | Description | Indexes |
|--------|------|-------------|---------|
| id | UUID | Primary key | PK |
| configuration_id | UUID | Alert configuration | FK, IDX |
| triggered_at | TIMESTAMP | Trigger timestamp | IDX |
| trigger_data | JSONB | Data that triggered alert | - |
| notification_results | JSONB | Notification results | - |
| status | ENUM | triggered/acknowledged/resolved/escalated | IDX |
| acknowledged_at | TIMESTAMP | Acknowledgment timestamp | - |
| acknowledged_by | VARCHAR | User who acknowledged | - |
| resolved_at | TIMESTAMP | Resolution timestamp | - |
| notes | TEXT | Additional notes | - |
| created_at | TIMESTAMP | Creation timestamp | - |
| updated_at | TIMESTAMP | Update timestamp | - |

**Composite Indexes:**
- `(configuration_id, triggered_at)`
- `(status, triggered_at)`

## Database Configuration

### Connection Settings
```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=agent_patterns
DB_SYNC=true  # Auto-sync schema in development
DB_LOGGING=false  # Enable SQL logging
```

### Performance Considerations

1. **Indexing Strategy**
   - Primary indexes on all ID fields
   - Composite indexes for common query patterns
   - JSONB indexes for frequently queried JSON fields

2. **Partitioning** (Future Enhancement)
   - Consider partitioning `evaluation_results` by `created_at` for large datasets
   - Partition `alert_history` by month for efficient cleanup

3. **Data Retention**
   - Implement automated cleanup for old evaluation results
   - Archive historical data after 90 days
   - Keep aggregated data indefinitely

### Maintenance Tasks

1. **Regular Tasks**
   - VACUUM and ANALYZE daily
   - Update statistics weekly
   - Monitor index usage

2. **Monitoring**
   - Track slow queries
   - Monitor table sizes
   - Watch for index bloat