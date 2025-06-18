# Evaluation Calibration and Bias Mitigation Guide

## Overview

This document describes the calibration methodology and bias mitigation strategies implemented in the Agent Patterns evaluation framework. The system ensures reliable, unbiased evaluations through human baseline scoring, weight optimization, and comprehensive bias detection.

## Architecture Components

### 1. Gold Dataset Management (`GoldDatasetService`)
- **Purpose**: Manages curated evaluation samples with human scores
- **Storage**: File-based JSON storage in `data/gold-datasets/`
- **Features**:
  - Stratified sampling by complexity
  - Version control for datasets
  - Edge case tracking
  - Inter-rater agreement calculation

### 2. Calibration Service (`CalibrationService`)
- **Purpose**: Optimizes evaluation weights to maximize correlation with human judgments
- **Algorithm**: Gradient-based optimization with Spearman correlation objective
- **Features**:
  - Pattern-specific weight tuning
  - Length normalization
  - Position randomization
  - Confidence interval calculation

### 3. Human Scoring Interface (`HumanScoringService`)
- **Purpose**: Facilitates human evaluation collection
- **Features**:
  - Evaluator progress tracking
  - Scoring rubric management
  - Inter-rater reliability metrics
  - Stratified sample distribution

### 4. Ensemble Evaluation (`EnsembleEvaluationService`)
- **Purpose**: Reduces model-specific biases through multi-model evaluation
- **Strategies**:
  - Average: Simple mean of all model scores
  - Weighted: Weighted average based on model performance
  - Consensus: Median-based robust estimation
  - Max: Optimistic scoring for specific patterns

### 5. Bias Detection (`BiasDetectionService`)
- **Purpose**: Identifies and alerts on systematic biases
- **Bias Types**:
  - Length bias: Correlation between response length and scores
  - Position bias: Score variation based on evaluation order
  - Complexity bias: Systematic differences across complexity levels
  - Evaluator bias: Individual evaluator tendencies
  - Temporal bias: Score drift over time

## Calibration Methodology

### Step 1: Gold Dataset Collection
```typescript
// Target: 100 samples per pattern (600 total)
// Distribution: 33% low, 33% medium, 33% high complexity
// Edge cases: 20% of samples
```

### Step 2: Human Baseline Scoring
1. **Evaluator Training**: Provide rubrics and examples
2. **Double-blind Process**: Evaluators don't see each other's scores
3. **Minimum Coverage**: Each sample scored by ≥2 evaluators
4. **Time Tracking**: Monitor evaluation time for quality control

### Step 3: Weight Optimization
```typescript
// Objective: Maximize Spearman correlation with human scores
// Method: Iterative gradient approximation
// Constraints: Weights sum to 1, all weights ∈ [0,1]
```

#### Optimization Algorithm:
1. Initialize weights (default: equal distribution)
2. For each iteration:
   - Evaluate samples with current weights
   - Calculate Spearman correlation with human scores
   - Update weights using gradient approximation
   - Check convergence criteria
3. Return weights with highest correlation

### Step 4: Reliability Metrics

#### Krippendorff's Alpha
- **Purpose**: Measure inter-rater agreement
- **Interpretation**:
  - α ≥ 0.8: Good reliability
  - 0.67 ≤ α < 0.8: Acceptable reliability
  - α < 0.67: Low reliability, needs improvement

#### Bootstrap Confidence Intervals
- **Method**: Resampling with replacement (1000 iterations)
- **Output**: 95% confidence interval for correlation
- **Usage**: Assess calibration stability

## Bias Mitigation Strategies

### 1. Length Normalization
```typescript
normalizedScore = score * (0.8 + 0.2 * lengthPenalty)
lengthPenalty = exp(-log(length/optimalLength)²/2)
```

### 2. Position Randomization
- Shuffle evaluation order for each evaluator
- Aggregate scores across different orderings
- Detect position-based fatigue effects

### 3. Ensemble Evaluation
- Use multiple models (Gemini Pro + Flash)
- Pattern-specific ensemble strategies
- Disagreement detection and alerting

### 4. Temporal Recalibration
- **Frequency**: Monthly or after 1000 evaluations
- **Trigger**: Drift detection (>10% score change)
- **Process**: Re-run calibration with recent samples

## Implementation Guidelines

### Adding New Patterns
1. Create pattern-specific rubric
2. Collect initial 30 samples minimum
3. Run baseline calibration
4. Monitor for pattern-specific biases

### Human Evaluator Management
1. **Onboarding**: Training session with practice samples
2. **Monitoring**: Track agreement with consensus
3. **Feedback**: Regular calibration sessions
4. **Incentives**: Performance-based recognition

### Calibration Schedule
- **Initial**: Full calibration with 100 samples
- **Weekly**: Bias detection analysis
- **Monthly**: Weight recalibration if needed
- **Quarterly**: Full dataset review and cleanup

## API Usage

### Calibrate a Pattern
```typescript
const calibration = await calibrationService.calibratePattern(
  AgentPattern.SEQUENTIAL,
  {
    maxIterations: 100,
    learningRate: 0.01,
    convergenceThreshold: 0.001
  }
);
```

### Evaluate with Calibration
```typescript
const score = await calibrationService.evaluateWithCalibration(
  AgentPattern.SEQUENTIAL,
  input,
  output,
  context
);
```

### Detect Biases
```typescript
const biasReport = await biasDetectionService.detectBias(
  AgentPattern.SEQUENTIAL
);

// Check alerts
biasReport.alerts.forEach(alert => {
  if (alert.severity === 'high') {
    console.error(`High bias detected: ${alert.message}`);
  }
});
```

### Human Scoring Workflow
```typescript
// 1. Get unscored samples
const samples = await humanScoringService.getUnscoreSamples(
  pattern,
  evaluatorId,
  10
);

// 2. Submit scores
await goldDatasetService.addHumanScore(
  pattern,
  sampleId,
  {
    evaluatorId,
    timestamp: new Date(),
    scores: { overall: 8, accuracy: 8, coherence: 7 },
    timeSpent: 45
  }
);

// 3. Check agreement
const stats = await humanScoringService.calculateAgreementStatistics(pattern);
```

## Monitoring and Alerts

### Key Metrics to Monitor
1. **Calibration Quality**
   - Spearman correlation (target: >0.7)
   - Confidence interval width (target: <0.2)
   - Validation MSE (target: <1.0)

2. **Bias Indicators**
   - Overall bias score (alert: >0.5)
   - Individual bias scores (alert: >0.7)
   - Evaluator outliers (>2σ from mean)

3. **Data Quality**
   - Sample coverage by complexity
   - Edge case representation (target: 20%)
   - Evaluator participation rate

### Alert Response Procedures

#### High Length Bias
1. Review scoring rubrics for length preferences
2. Implement stronger length normalization
3. Retrain evaluators on length-agnostic scoring

#### High Position Bias
1. Increase break frequency for evaluators
2. Implement mandatory position randomization
3. Limit consecutive evaluations

#### High Evaluator Bias
1. Schedule calibration session
2. Review outlier evaluator scores
3. Consider weighted averaging by consistency

## Best Practices

### For Developers
1. Always check calibration status before evaluation
2. Log bias detection results for monitoring
3. Use ensemble evaluation for critical assessments
4. Implement graceful fallbacks for missing calibration

### For Evaluators
1. Take breaks every 10 evaluations
2. Review rubric before each session
3. Focus on relative quality, not absolute perfection
4. Report unclear or ambiguous samples

### For System Administrators
1. Backup gold datasets regularly
2. Monitor disk usage for calibration cache
3. Schedule maintenance during low-usage periods
4. Keep calibration logs for audit trails

## Troubleshooting

### Low Correlation After Calibration
- Check sample quality and diversity
- Verify human score consistency
- Increase optimization iterations
- Review rubric clarity

### Persistent Bias Alerts
- Analyze bias patterns over time
- Adjust mitigation parameters
- Consider pattern-specific solutions
- Consult with domain experts

### Evaluator Disagreement
- Review problematic samples together
- Clarify rubric interpretations
- Provide additional training examples
- Consider removing ambiguous samples

## Future Enhancements

1. **Active Learning**: Automatically identify samples needing human review
2. **Multi-dimensional Optimization**: Optimize for multiple metrics simultaneously
3. **Adaptive Rubrics**: Dynamically adjust rubrics based on pattern evolution
4. **Cross-pattern Transfer**: Share calibration insights across similar patterns
5. **Real-time Monitoring**: Live bias detection during evaluation sessions