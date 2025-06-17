# Plan for Issue 7: Evaluation Framework Foundation

This document outlines the step-by-step plan to complete `issues/7-evaluationframeworkfoundation.md`.

## Implementation Plan

### 1. Create Evaluation Module Structure
- [ ] Create `packages/api/src/evaluation` directory
- [ ] Create `evaluation.module.ts` with module definition
- [ ] Add evaluation module to app.module.ts imports

### 2. Define Core Interfaces and Types
- [ ] Create `interfaces/evaluation.interface.ts` with:
  - `EvaluationMetric` interface
  - `EvaluationConfig` interface
  - `TestCase` interface
  - `MetricScore` interface
  - `EvaluationResult` interface
  - `EvaluationDetails` interface
- [ ] Create `enums/judge-model.enum.ts` for supported judge models
- [ ] Create `enums/agent-pattern.enum.ts` for pattern types

### 3. Implement Base LLM Judge Class
- [ ] Create `services/llm-judge.service.ts` with:
  - Abstract base class for LLM judges
  - Common evaluation logic
  - Prompt template management
  - Score normalization methods
- [ ] Create provider factory for different judge backends
- [ ] Implement judge model selection logic

### 4. Create G-Eval Integration
- [ ] Create `services/g-eval.service.ts` with:
  - G-Eval rubric parser
  - Chain-of-thought step generation
  - Binary check decomposition
  - Score aggregation logic
- [ ] Implement prompt templates for G-Eval methodology
- [ ] Add bias mitigation features (position shuffling, length normalization)

### 5. Build Test Case Management
- [ ] Create `services/test-case.service.ts` with:
  - Test case storage and retrieval
  - Test case validation
  - Coverage analysis methods
- [ ] Create test case generator base class
- [ ] Implement test case selection strategies

### 6. Implement Core Evaluation Service
- [ ] Create `services/evaluation.service.ts` with:
  - Main evaluation orchestration logic
  - Pattern-agnostic evaluation flow
  - Result aggregation and storage
  - Error handling and retry logic
- [ ] Implement evaluation workflow steps
- [ ] Add performance metrics collection

### 7. Create Configuration Management
- [ ] Add evaluation configuration to `.env`:
  - EVALUATION_JUDGE_MODEL
  - EVALUATION_RUBRIC_PATH
  - EVALUATION_SAMPLE_SIZE
  - EVALUATION_BATCH_SIZE
  - EVALUATION_TIMEOUT_MS
  - EVALUATION_RETRY_ATTEMPTS
- [ ] Create configuration service for evaluation settings
- [ ] Add validation for configuration values

### 8. Implement Reliability Checks
- [ ] Create `services/reliability.service.ts` with:
  - Krippendorff's alpha calculation
  - Bootstrap confidence intervals
  - Inter-rater reliability metrics
- [ ] Add consistency checking methods
- [ ] Implement score calibration logic

### 9. Add Unit Tests
- [ ] Test LLM judge base class
- [ ] Test G-Eval service
- [ ] Test evaluation service
- [ ] Test reliability calculations
- [ ] Test configuration management
- [ ] Mock external LLM calls

### 10. Create Documentation
- [ ] Document evaluation architecture
- [ ] Create API documentation for services
- [ ] Add usage examples
- [ ] Document configuration options
- [ ] Create troubleshooting guide
