import { Injectable, Logger } from '@nestjs/common';
import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';
import {
  EvaluationConfig,
  MetricScore,
  TestCase,
  EvaluationDetails,
  RubricStep,
  BiasCheck,
} from '../interfaces/evaluation.interface';
import { JudgeModel, JUDGE_MODEL_PROVIDERS } from '../enums/judge-model.enum';

const MetricScoreSchema = z.object({
  metric: z.string(),
  score: z.number(),
  reasoning: z.string(),
  confidence: z.number().min(0).max(1).optional(),
});

const EvaluationResultSchema = z.object({
  metricScores: z.array(MetricScoreSchema),
  chainOfThought: z.array(z.string()).optional(),
  overallAssessment: z.string(),
});

@Injectable()
export class LlmJudgeService {
  protected readonly logger = new Logger(LlmJudgeService.name);

  async evaluate(
    testCase: TestCase,
    actualOutput: any,
    config: EvaluationConfig,
  ): Promise<{
    metricScores: MetricScore[];
    details: EvaluationDetails;
  }> {
    this.logger.log(`Evaluating test case ${testCase.id} with judge model ${config.judgeModel}`);

    const model = this.getJudgeModel(config.judgeModel);
    const prompt = this.buildEvaluationPrompt(testCase, actualOutput, config);

    try {
      const evaluationResult = await this.runEvaluation(model, prompt, config);
      const normalizedScores = this.normalizeScores(evaluationResult.metricScores, config);
      const biasChecks = config.enableBiasmitigaation
        ? await this.performBiasChecks(testCase, actualOutput, config)
        : undefined;

      return {
        metricScores: normalizedScores,
        details: {
          actualOutput,
          expectedOutput: testCase.expectedOutput,
          chainOfThought: evaluationResult.chainOfThought,
          biasChecks,
        },
      };
    } catch (error) {
      this.logger.error(`Evaluation failed for test case ${testCase.id}:`, error);
      throw error;
    }
  }

  protected getJudgeModel(judgeModel: JudgeModel): any {
    const provider = JUDGE_MODEL_PROVIDERS[judgeModel];

    switch (provider) {
      case 'google':
        return google(judgeModel);
      case 'openai':
        throw new Error('OpenAI provider not yet implemented');
      case 'anthropic':
        throw new Error('Anthropic provider not yet implemented');
      case 'local':
        throw new Error('Local model providers not yet implemented');
      default:
        throw new Error(`Unsupported judge model: ${judgeModel}`);
    }
  }

  protected buildEvaluationPrompt(
    testCase: TestCase,
    actualOutput: any,
    config: EvaluationConfig,
  ): string {
    const metricsDescription = config.metrics
      .map(
        (m) => `- ${m.name}: ${m.description} (Score range: ${m.scoreRange[0]}-${m.scoreRange[1]})`,
      )
      .join('\n');

    return `
You are an expert evaluator for AI agent outputs. Please evaluate the following output based on the given metrics.

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

${
  testCase.context
    ? `Additional Context:
${JSON.stringify(testCase.context, null, 2)}`
    : ''
}

Evaluation Metrics:
${metricsDescription}

Please provide:
1. A chain of thought reasoning for your evaluation
2. A score for each metric with detailed reasoning
3. An overall assessment of the output quality

Be objective, thorough, and provide specific examples to support your scores.
`;
  }

  protected async runEvaluation(
    model: any,
    prompt: string,
    config: EvaluationConfig,
  ): Promise<z.infer<typeof EvaluationResultSchema>> {
    const temperature = config.temperature ?? 0.1;
    const maxRetries = config.maxRetries ?? 3;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const { object } = await generateObject({
          model,
          schema: EvaluationResultSchema,
          prompt,
          temperature,
        });

        return object;
      } catch (error) {
        this.logger.warn(`Evaluation attempt ${attempt + 1} failed:`, error);
        if (attempt === maxRetries - 1) throw error;
      }
    }

    throw new Error('All evaluation attempts failed');
  }

  protected normalizeScores(
    scores: Array<{ metric: string; score: number; reasoning: string; confidence?: number }>,
    config: EvaluationConfig,
  ): MetricScore[] {
    return scores.map((score) => {
      const metric = config.metrics.find((m) => m.name === score.metric);
      if (!metric) {
        throw new Error(`Unknown metric: ${score.metric}`);
      }

      const [min, max] = metric.scoreRange;
      const normalizedScore = (score.score - min) / (max - min);

      return {
        metric: score.metric,
        score: score.score,
        normalizedScore: Math.max(0, Math.min(1, normalizedScore)),
        reasoning: score.reasoning,
        confidence: score.confidence,
      };
    });
  }

  protected async performBiasChecks(
    testCase: TestCase,
    actualOutput: any,
    config: EvaluationConfig,
  ): Promise<BiasCheck[]> {
    const checks: BiasCheck[] = [];

    // Position bias check: Re-evaluate with shuffled input order if applicable
    if (Array.isArray(testCase.input) || (testCase.input && typeof testCase.input === 'object')) {
      checks.push({
        type: 'position',
        passed: true, // Placeholder - would implement actual position shuffling test
        details: 'Position bias check not yet implemented',
      });
    }

    // Length bias check: Compare evaluation consistency across different output lengths
    const outputLength = JSON.stringify(actualOutput).length;
    checks.push({
      type: 'length',
      passed: outputLength > 10 && outputLength < 10000,
      details: `Output length: ${outputLength} characters`,
    });

    // Format bias check: Ensure consistent evaluation regardless of formatting
    checks.push({
      type: 'format',
      passed: true, // Placeholder - would implement format normalization test
      details: 'Format bias check not yet implemented',
    });

    return checks;
  }

  async evaluateWithRubric(
    testCase: TestCase,
    actualOutput: any,
    rubricSteps: string[],
    config: EvaluationConfig,
  ): Promise<{
    rubricScores: RubricStep[];
    aggregatedScore: number;
  }> {
    const model = this.getJudgeModel(config.judgeModel);
    const rubricResults: RubricStep[] = [];

    for (let i = 0; i < rubricSteps.length; i++) {
      const stepPrompt = `
Evaluate the following output based on this specific rubric step:

Step ${i + 1}: ${rubricSteps[i]}

Test Case Input:
${JSON.stringify(testCase.input, null, 2)}

Actual Output:
${JSON.stringify(actualOutput, null, 2)}

Provide a score (1-10) and detailed evaluation for this specific step only.
`;

      const { object } = await generateObject({
        model,
        schema: z.object({
          evaluation: z.string(),
          score: z.number().min(1).max(10),
        }),
        prompt: stepPrompt,
        temperature: 0.1,
      });

      rubricResults.push({
        step: i + 1,
        description: rubricSteps[i],
        evaluation: object.evaluation,
        score: object.score,
      });
    }

    // Aggregate scores with equal weighting
    const aggregatedScore =
      rubricResults.reduce((sum, step) => sum + step.score, 0) / rubricResults.length;

    return { rubricScores: rubricResults, aggregatedScore };
  }
}
