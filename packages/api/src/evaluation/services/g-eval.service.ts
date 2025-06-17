import { Injectable, Logger } from '@nestjs/common';
import { google } from '@ai-sdk/google';
import { generateObject, generateText } from 'ai';
import { z } from 'zod';
import {
  EvaluationConfig,
  MetricScore,
  TestCase,
  RubricStep,
} from '../interfaces/evaluation.interface';
import { LlmJudgeService } from './llm-judge.service';

const GEvalStepSchema = z.object({
  steps: z.array(z.string()),
  binaryChecks: z.array(z.string()).optional(),
});

const GEvalScoreSchema = z.object({
  score: z.number().min(1).max(10),
  reasoning: z.string(),
  stepResults: z.array(
    z.object({
      step: z.string(),
      result: z.string(),
      passed: z.boolean().optional(),
    }),
  ),
});

@Injectable()
export class GEvalService extends LlmJudgeService {
  async evaluateWithGEval(
    testCase: TestCase,
    actualOutput: any,
    metric: string,
    config: EvaluationConfig,
  ): Promise<MetricScore> {
    this.logger.log(`Performing G-Eval for metric: ${metric}`);

    try {
      // Step 1: Generate chain-of-thought evaluation steps
      const evaluationSteps = await this.generateEvaluationSteps(testCase, metric, config);

      // Step 2: Decompose into binary checks if applicable
      const binaryChecks = await this.decomposeToBinaryChecks(evaluationSteps.steps, config);

      // Step 3: Execute evaluation following the steps
      const evaluationResult = await this.executeGEvalSteps(
        testCase,
        actualOutput,
        evaluationSteps.steps,
        binaryChecks,
        config,
      );

      // Step 4: Normalize and return the score
      return {
        metric,
        score: evaluationResult.score,
        normalizedScore: (evaluationResult.score - 1) / 9, // Normalize 1-10 to 0-1
        reasoning: evaluationResult.reasoning,
        details: {
          steps: evaluationSteps.steps,
          stepResults: evaluationResult.stepResults,
          binaryChecks,
        },
      };
    } catch (error) {
      this.logger.error(`G-Eval failed for metric ${metric}:`, error);
      throw error;
    }
  }

  private async generateEvaluationSteps(
    testCase: TestCase,
    metric: string,
    config: EvaluationConfig,
  ): Promise<{ steps: string[]; binaryChecks?: string[] }> {
    const model = this.getJudgeModel(config.judgeModel);
    const metricDef = config.metrics.find((m) => m.name === metric);

    if (!metricDef) {
      throw new Error(`Metric ${metric} not found in configuration`);
    }

    const prompt = `
You are an expert evaluator. Generate a detailed chain-of-thought evaluation process for assessing the following metric:

Metric: ${metric}
Description: ${metricDef.description}
Score Range: ${metricDef.scoreRange[0]}-${metricDef.scoreRange[1]}

Context about the task:
${JSON.stringify(testCase.context || {}, null, 2)}

Generate 3-7 specific evaluation steps that would help assess this metric thoroughly.
If the metric can be evaluated through binary checks (yes/no questions), also provide those.

Focus on:
1. Clear, actionable evaluation criteria
2. Objective assessment points
3. Specific aspects to examine in the output
`;

    const { object } = await generateObject({
      model,
      schema: GEvalStepSchema,
      prompt,
      temperature: 0.3,
    });

    return object;
  }

  private async decomposeToBinaryChecks(
    steps: string[],
    config: EvaluationConfig,
  ): Promise<string[]> {
    const model = this.getJudgeModel(config.judgeModel);
    const binaryChecks: string[] = [];

    for (const step of steps) {
      const prompt = `
Convert the following evaluation step into 1-3 binary (yes/no) check questions:

Step: ${step}

Provide specific yes/no questions that can objectively assess this criterion.
`;

      const { text } = await generateText({
        model,
        prompt,
        temperature: 0.2,
      });

      const checks = text
        .split('\n')
        .filter((line) => line.trim() && line.includes('?'))
        .map((line) => line.trim());

      binaryChecks.push(...checks);
    }

    return binaryChecks.slice(0, 10); // Limit to 10 binary checks
  }

  private async executeGEvalSteps(
    testCase: TestCase,
    actualOutput: any,
    steps: string[],
    binaryChecks: string[],
    config: EvaluationConfig,
  ): Promise<z.infer<typeof GEvalScoreSchema>> {
    const model = this.getJudgeModel(config.judgeModel);

    const prompt = `
Evaluate the following output using the G-Eval methodology.

Test Case Input:
${JSON.stringify(testCase.input, null, 2)}

${
  testCase.expectedOutput
    ? `Expected Output:
${JSON.stringify(testCase.expectedOutput, null, 2)}`
    : ''
}

Actual Output:
${JSON.stringify(actualOutput, null, 2)}

Evaluation Steps:
${steps.map((step, i) => `${i + 1}. ${step}`).join('\n')}

${
  binaryChecks.length > 0
    ? `Binary Checks:
${binaryChecks.map((check, i) => `${i + 1}. ${check}`).join('\n')}`
    : ''
}

For each step:
1. Analyze the output against the criterion
2. Provide specific observations
3. Note if the criterion is met (for binary checks, answer yes/no)

Finally, provide an overall score from 1-10 based on your step-by-step analysis.
`;

    const { object } = await generateObject({
      model,
      schema: GEvalScoreSchema,
      prompt,
      temperature: 0.1,
    });

    return object;
  }

  async parseGEvalRubric(rubricPath: string): Promise<string[]> {
    // In a real implementation, this would read from a file
    // For now, return a sample rubric structure
    return [
      'Check if the output addresses all aspects of the input request',
      'Evaluate the accuracy and correctness of the information provided',
      'Assess the clarity and coherence of the response',
      'Verify that the output format matches expectations',
      'Check for any errors, inconsistencies, or missing information',
    ];
  }

  normalizeGEvalScore(rawScore: number, metric: string, scoreRange: [number, number]): number {
    const [min, max] = scoreRange;

    // Apply metric-specific normalization
    let adjustedScore = rawScore;

    // Example: Some metrics might need logarithmic scaling
    if (metric.toLowerCase().includes('complexity')) {
      adjustedScore = Math.log10(rawScore + 1) * 3.32; // Log scale to 0-10
    }

    // Ensure score is within bounds
    adjustedScore = Math.max(min, Math.min(max, adjustedScore));

    // Normalize to 0-1 range
    return (adjustedScore - min) / (max - min);
  }

  async performConsistencyCheck(
    testCase: TestCase,
    actualOutput: any,
    metric: string,
    config: EvaluationConfig,
    numRuns: number = 3,
  ): Promise<{
    scores: number[];
    variance: number;
    isConsistent: boolean;
  }> {
    const scores: number[] = [];

    for (let i = 0; i < numRuns; i++) {
      const result = await this.evaluateWithGEval(
        testCase,
        actualOutput,
        metric,
        { ...config, temperature: 0.3 }, // Slightly higher temperature for variance
      );
      scores.push(result.score);
    }

    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance =
      scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;

    // Consider evaluation consistent if variance is low (< 1.0 on 1-10 scale)
    const isConsistent = variance < 1.0;

    return { scores, variance, isConsistent };
  }
}
