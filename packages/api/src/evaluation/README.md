# Evaluation Framework

The evaluation framework provides a comprehensive system for assessing the quality and performance of AI agent patterns. It implements LLM-as-judge evaluation with support for multiple judge models, G-Eval methodology, and reliability metrics.

## Architecture Overview

### Core Components

1. **EvaluationService** - Main orchestration service for evaluations
2. **LlmJudgeService** - Base LLM judge implementation
3. **GEvalService** - G-Eval methodology implementation
4. **TestCaseService** - Test case management
5. **ReliabilityService** - Reliability metrics calculation
6. **EvaluationConfigService** - Configuration management

### Key Interfaces

```typescript
interface EvaluationConfig {
  pattern: AgentPattern;
  judgeModel: JudgeModel;
  metrics: EvaluationMetric[];
  temperature?: number;
  maxRetries?: number;
  timeoutMs?: number;
  batchSize?: number;
  enableBiasmitigaation?: boolean;
  enableReliabilityChecks?: boolean;
}

interface TestCase {
  id: string;
  pattern: AgentPattern;
  input: any;
  expectedOutput?: any;
  context?: Record<string, any>;
  metadata?: {
    difficulty?: 'easy' | 'medium' | 'hard';
    category?: string;
    tags?: string[];
  };
}

interface EvaluationResult {
  testCaseId: string;
  pattern: AgentPattern;
  judgeModel: JudgeModel;
  metricScores: MetricScore[];
  overallScore: number;
  pass: boolean;
  executionTimeMs: number;
  timestamp: Date;
  error?: string;
  details?: EvaluationDetails;
}
```

## Usage

### Basic Evaluation

```typescript
import { EvaluationService } from './evaluation/services/evaluation.service';

// Evaluate a single test case
const testCase: TestCase = {
  id: 'test-1',
  pattern: AgentPattern.SEQUENTIAL_PROCESSING,
  input: { prompt: 'Create marketing copy for developers' },
  expectedOutput: { content: 'Expected marketing content' },
};

const actualOutput = await yourAgentFunction(testCase.input);
const result = await evaluationService.evaluateSingle(testCase, actualOutput);
```

### Batch Evaluation

```typescript
// Evaluate multiple test cases
const testCases = await testCaseService.getTestCasesByPattern(
  AgentPattern.ROUTING,
  { difficulty: 'medium', limit: 10 }
);

const outputs = new Map<string, any>();
for (const tc of testCases) {
  outputs.set(tc.id, await yourAgentFunction(tc.input));
}

const batchResult = await evaluationService.evaluateBatch(
  AgentPattern.ROUTING,
  testCases,
  outputs
);
```

### Pattern Evaluation

```typescript
// Evaluate an entire pattern with automatic execution
const evaluation = await evaluationService.evaluatePattern(
  AgentPattern.MULTI_STEP_TOOL_USAGE,
  async (input) => {
    // Your pattern execution logic
    return await multiStepToolUsageService.execute(input);
  },
  {
    testCaseLimit: 20,
    testCaseFilter: {
      difficulty: 'hard',
      tags: ['complex-calculation'],
    },
  }
);
```

## Configuration

### Environment Variables

Add these to your `.env` file:

```env
# Judge model selection
EVALUATION_JUDGE_MODEL=gemini-2.5-pro-preview-06-05

# Evaluation parameters
EVALUATION_BATCH_SIZE=5
EVALUATION_TIMEOUT_MS=30000
EVALUATION_RETRY_ATTEMPTS=3

# Optional: Custom rubric path
EVALUATION_RUBRIC_PATH=/path/to/rubric.yaml
```

### Pattern-Specific Configuration

Each pattern has default metrics and configurations:

- **Sequential Processing**: content_quality, call_to_action, emotional_appeal, clarity
- **Routing**: classification_accuracy, routing_appropriateness, response_relevance
- **Parallel Processing**: analysis_completeness, consistency, aggregation_quality
- **Orchestrator-Worker**: task_decomposition, worker_coordination, implementation_correctness
- **Evaluator-Optimizer**: optimization_effectiveness, evaluation_accuracy, convergence_rate
- **Multi-Step Tool Usage**: tool_selection_accuracy, step_correctness, final_answer_accuracy

### Custom Configuration

```typescript
const customConfig: Partial<EvaluationConfig> = {
  judgeModel: JudgeModel.CLAUDE_3_5_SONNET,
  temperature: 0.2,
  metrics: [
    {
      name: 'custom_metric',
      description: 'Custom evaluation metric',
      scoreRange: [0, 100],
      weight: 2,
    },
  ],
  enableBiasmitigaation: true,
  enableReliabilityChecks: true,
};

const result = await evaluationService.evaluateSingle(
  testCase,
  actualOutput,
  customConfig
);
```

## G-Eval Methodology

The framework supports G-Eval, a chain-of-thought evaluation approach:

```typescript
// Enable G-Eval by providing a rubric path
const gEvalConfig: Partial<EvaluationConfig> = {
  rubricPath: '/path/to/rubric.yaml',
};

// G-Eval automatically:
// 1. Generates evaluation steps
// 2. Decomposes to binary checks
// 3. Executes step-by-step evaluation
// 4. Aggregates scores
```

## Reliability Metrics

### Krippendorff's Alpha

Measures inter-rater reliability across evaluations:

```typescript
const reliability = await reliabilityService.calculateReliability(evaluationResults);
console.log(`Krippendorff's α: ${reliability.krippendorffsAlpha}`);
// α > 0.8: High reliability
// α > 0.667: Acceptable reliability
// α < 0.667: Low reliability
```

### Consistency Validation

```typescript
const validation = await reliabilityService.validateEvaluationConsistency(
  results,
  0.7 // threshold
);

if (!validation.isConsistent) {
  console.log('Recommendations:', validation.recommendations);
}
```

## Test Case Management

### Creating Test Cases

```typescript
const testCase = await testCaseService.createTestCase({
  pattern: AgentPattern.EVALUATOR_OPTIMIZER,
  input: { 
    text: 'Hello world',
    targetLanguage: 'Spanish',
  },
  expectedOutput: {
    translation: 'Hola mundo',
  },
  metadata: {
    difficulty: 'easy',
    category: 'basic-translation',
    tags: ['greeting', 'common-phrase'],
  },
});
```

### Coverage Analysis

```typescript
const coverage = await testCaseService.getCoverageAnalysis(
  AgentPattern.ORCHESTRATOR_WORKER
);

console.log(`Total test cases: ${coverage.totalTestCases}`);
console.log(`By difficulty:`, coverage.byDifficulty);
console.log(`Coverage gaps:`, coverage.coverageGaps);
```

### Test Case Suggestions

```typescript
const suggestions = await testCaseService.generateTestCaseSuggestions(
  AgentPattern.ROUTING,
  existingTestCases
);

console.log('Suggested categories:', suggestions.suggestedCategories);
console.log('Missing difficulties:', suggestions.suggestedDifficulties);
console.log('Scenario ideas:', suggestions.suggestedScenarios);
```

## Supported Judge Models

- **Google Gemini**: gemini-2.5-pro, gemini-2.5-flash
- **OpenAI**: gpt-4o, gpt-4o-mini (coming soon)
- **Anthropic**: claude-3-opus, claude-3.5-sonnet, claude-3-haiku (coming soon)
- **Local**: vLLM, Ollama (coming soon)

## Best Practices

1. **Test Case Design**
   - Include diverse difficulty levels
   - Cover edge cases and failure scenarios
   - Provide clear expected outputs when possible
   - Use metadata for categorization

2. **Evaluation Configuration**
   - Use lower temperature (0.0-0.2) for consistency
   - Enable reliability checks for production
   - Set appropriate timeouts for complex evaluations
   - Use pattern-specific metrics

3. **Bias Mitigation**
   - Enable bias mitigation for subjective metrics
   - Use multiple judge models for comparison
   - Implement position and length bias checks

4. **Performance Optimization**
   - Use batch evaluation for multiple test cases
   - Configure appropriate batch sizes
   - Cache evaluation results when possible
   - Use faster models (Flash) for simple metrics

## Troubleshooting

### Common Issues

1. **Low Reliability Scores**
   - Increase temperature consistency (lower values)
   - Provide clearer evaluation criteria
   - Use G-Eval methodology for complex metrics

2. **Timeout Errors**
   - Increase EVALUATION_TIMEOUT_MS
   - Reduce batch size
   - Use faster judge models

3. **Inconsistent Results**
   - Enable reliability checks
   - Use deterministic temperature (0.0)
   - Implement retry logic

### Debug Mode

```typescript
// Enable detailed logging
const result = await evaluationService.evaluateSingle(
  testCase,
  actualOutput,
  {
    ...config,
    debug: true, // Logs detailed evaluation steps
  }
);
```

## Extending the Framework

### Adding New Judge Models

1. Add the model to `enums/judge-model.enum.ts`:
```typescript
export enum JudgeModel {
  // ... existing models
  YOUR_MODEL = 'your-model-id',
}
```

2. Update provider mapping:
```typescript
export const JUDGE_MODEL_PROVIDERS: Record<JudgeModel, string> = {
  // ... existing mappings
  [JudgeModel.YOUR_MODEL]: 'your-provider',
};
```

3. Implement model initialization in `LlmJudgeService`:
```typescript
protected getJudgeModel(judgeModel: JudgeModel): any {
  switch (provider) {
    case 'your-provider':
      return yourProviderSDK(judgeModel);
    // ... other cases
  }
}
```

### Custom Evaluation Strategies

Create a custom evaluation service:

```typescript
@Injectable()
export class CustomEvaluationService extends LlmJudgeService {
  async evaluateWithCustomLogic(
    testCase: TestCase,
    actualOutput: any,
    config: EvaluationConfig
  ): Promise<MetricScore[]> {
    // Custom evaluation logic
    const baseScores = await super.evaluate(testCase, actualOutput, config);
    
    // Apply custom transformations
    return this.applyCustomScoring(baseScores);
  }
}
```

### Custom Reliability Metrics

Extend the reliability service:

```typescript
@Injectable()
export class ExtendedReliabilityService extends ReliabilityService {
  calculateCustomMetric(results: EvaluationResult[]): number {
    // Implement custom statistical measure
    return customCalculation(results);
  }
}
```

## API Reference

See the TypeScript interfaces and service documentation for detailed API information:

- [EvaluationService](./services/evaluation.service.ts)
- [TestCaseService](./services/test-case.service.ts)
- [ReliabilityService](./services/reliability.service.ts)
- [Interfaces](./interfaces/evaluation.interface.ts)
- [Enums](./enums/)