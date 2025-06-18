import { Injectable } from '@nestjs/common';
import { PatternEvaluatorBase } from './pattern-evaluator.base';
import { AgentPattern } from '../enums/agent-pattern.enum';
import {
  TestCase,
  EvaluationResult,
  EvaluationConfig,
  MetricScore,
} from '../interfaces/evaluation.interface';

interface MultiStepToolUsageInput {
  problem: string;
  requiresSteps: string[];
  allowedTools?: string[];
}

interface MathStep {
  description: string;
  tool: string;
  calculation: string;
  result: number | string;
}

interface MultiStepToolUsageResponse {
  steps: MathStep[];
  finalAnswer: number | string;
  explanation: string;
  toolsUsed: string[];
  confidence: number;
}

@Injectable()
export class MultiStepToolUsageEvaluator extends PatternEvaluatorBase {
  pattern = AgentPattern.MULTI_STEP_TOOL_USAGE;

  generateTestCases(count: number, complexity?: 'simple' | 'moderate' | 'complex'): TestCase[] {
    const testCases: TestCase[] = [];
    const scenarios = this.getScenarios(complexity);

    for (let i = 0; i < count; i++) {
      const scenario = scenarios[i % scenarios.length];
      testCases.push(
        this.generateBaseTestCase(this.pattern, scenario.input, scenario.expectedBehavior, {
          complexity,
          category: scenario.category,
          expectedAnswer: scenario.expectedAnswer,
        }),
      );
    }

    return testCases;
  }

  async evaluateResponse(
    testCase: TestCase,
    response: MultiStepToolUsageResponse,
    config: EvaluationConfig,
  ): Promise<EvaluationResult> {
    const scores: MetricScore[] = [];

    // Answer Correctness
    if (config.metrics.includes('answer_correctness')) {
      const correctnessScore = this.evaluateAnswerCorrectness(testCase, response);
      scores.push(correctnessScore);
    }

    // Tool Selection
    if (config.metrics.includes('tool_selection')) {
      const toolScore = this.evaluateToolSelection(testCase, response);
      scores.push(toolScore);
    }

    // Step Efficiency
    if (config.metrics.includes('step_efficiency')) {
      const efficiencyScore = this.evaluateStepEfficiency(testCase, response);
      scores.push(efficiencyScore);
    }

    // Calculation Accuracy
    if (config.metrics.includes('calculation_accuracy')) {
      const calculationScore = this.evaluateCalculationAccuracy(response);
      scores.push(calculationScore);
    }

    // Explanation Quality
    const explanationScore = this.evaluateExplanationQuality(testCase, response);
    scores.push(explanationScore);

    const overallScore = this.calculateWeightedScore(scores);
    const passed = overallScore >= (config.passingThreshold || 0.8);

    return {
      testCaseId: testCase.id,
      pattern: this.pattern,
      scores,
      overallScore,
      passed,
      feedback: this.generateFeedback(scores, response),
      timestamp: new Date().toISOString(),
    };
  }

  getEvaluationPrompt(
    metric: string,
    testCase: TestCase,
    response: MultiStepToolUsageResponse,
  ): string {
    const input = testCase.input as MultiStepToolUsageInput;

    switch (metric) {
      case 'answer_correctness':
        return `Evaluate the correctness of this mathematical solution:
Problem: ${input.problem}
Final Answer: ${response.finalAnswer}
Expected Answer: ${testCase.metadata?.expectedAnswer || 'Not provided'}

Evaluation Criteria:
1. Mathematical accuracy
2. Appropriate precision/rounding
3. Correct units (if applicable)
4. Complete answer to all parts
5. Logical consistency

Provide a score from 0-1 and detailed rationale.`;

      case 'tool_selection':
        return `Evaluate the tool selection for solving this problem:
Problem: ${input.problem}
Tools Used: ${response.toolsUsed.join(', ')}
Allowed Tools: ${input.allowedTools?.join(', ') || 'Any'}

Evaluation Criteria:
1. Appropriate tool choice for each step
2. Efficient tool usage
3. Adherence to allowed tools
4. Logical tool sequence
5. No unnecessary tools

Provide a score from 0-1 and detailed rationale.`;

      case 'step_efficiency':
        return `Evaluate the efficiency of the solution steps:
Problem: ${input.problem}
Number of Steps: ${response.steps.length}
Required Steps: ${input.requiresSteps.join(', ')}

Steps Taken:
${response.steps.map((s, i) => `${i + 1}. ${s.description}`).join('\n')}

Evaluation Criteria:
1. Optimal number of steps
2. No redundant calculations
3. Logical progression
4. Clear step breakdown
5. Efficient path to solution

Provide a score from 0-1 and detailed rationale.`;

      case 'explanation_quality':
        return `Evaluate the quality of the explanation:
Problem: ${input.problem}
Explanation: ${response.explanation}

Evaluation Criteria:
1. Clarity and completeness
2. Mathematical reasoning
3. Step-by-step logic
4. Accessibility to reader
5. Connection to final answer

Provide a score from 0-1 and detailed rationale.`;

      default:
        return '';
    }
  }

  private evaluateAnswerCorrectness(
    testCase: TestCase,
    response: MultiStepToolUsageResponse,
  ): MetricScore {
    const expectedAnswer = testCase.metadata?.expectedAnswer;
    let score = 0;

    if (expectedAnswer === undefined) {
      // Can't evaluate without expected answer
      return {
        metric: 'answer_correctness',
        score: 0.5,
        rationale: 'No expected answer provided for comparison.',
        weight: 2.0,
      };
    }

    // Check exact match or close approximation
    if (typeof expectedAnswer === 'number' && typeof response.finalAnswer === 'number') {
      const tolerance = Math.abs(expectedAnswer) * 0.01; // 1% tolerance
      if (Math.abs(response.finalAnswer - expectedAnswer) <= tolerance) {
        score = 1.0;
      } else if (Math.abs(response.finalAnswer - expectedAnswer) <= tolerance * 5) {
        score = 0.7; // Close but not exact
      } else {
        score = 0.2; // Wrong answer
      }
    } else if (String(response.finalAnswer) === String(expectedAnswer)) {
      score = 1.0;
    }

    return {
      metric: 'answer_correctness',
      score,
      rationale: `Answer ${response.finalAnswer} compared to expected ${expectedAnswer}.`,
      weight: 2.0,
    };
  }

  private evaluateToolSelection(
    testCase: TestCase,
    response: MultiStepToolUsageResponse,
  ): MetricScore {
    const input = testCase.input as MultiStepToolUsageInput;
    let score = 0.5; // Base score

    // Check if allowed tools constraint is followed
    if (input.allowedTools && input.allowedTools.length > 0) {
      const unauthorizedTools = response.toolsUsed.filter(
        (tool) => !input.allowedTools!.includes(tool),
      );
      if (unauthorizedTools.length === 0) {
        score += 0.3;
      } else {
        score -= 0.2;
      }
    } else {
      score += 0.2; // No restrictions
    }

    // Check for appropriate tool usage
    const commonMathTools = ['add', 'subtract', 'multiply', 'divide', 'power', 'sqrt'];
    const usedValidTools = response.toolsUsed.every(
      (tool) => commonMathTools.includes(tool) || (input.allowedTools?.includes(tool) ?? false),
    );
    if (usedValidTools) {
      score += 0.2;
    }

    // Check for tool diversity when needed
    if (input.requiresSteps.length > 1 && response.toolsUsed.length > 1) {
      score += 0.1;
    }

    return {
      metric: 'tool_selection',
      score: this.normalizeScore(score),
      rationale: `Tool selection evaluated for appropriateness and constraint adherence.`,
      weight: 1.2,
    };
  }

  private evaluateStepEfficiency(
    testCase: TestCase,
    response: MultiStepToolUsageResponse,
  ): MetricScore {
    const input = testCase.input as MultiStepToolUsageInput;
    let score = 0.5; // Base score

    // Check if all required steps are covered
    const requiredStepsCovered = input.requiresSteps.every((required) =>
      response.steps.some(
        (step) =>
          step.description.toLowerCase().includes(required.toLowerCase()) ||
          step.calculation.toLowerCase().includes(required.toLowerCase()),
      ),
    );
    if (requiredStepsCovered) {
      score += 0.3;
    }

    // Check for optimal number of steps
    const expectedSteps = input.requiresSteps.length;
    const actualSteps = response.steps.length;
    if (actualSteps === expectedSteps) {
      score += 0.2;
    } else if (Math.abs(actualSteps - expectedSteps) === 1) {
      score += 0.1;
    } else if (actualSteps > expectedSteps * 2) {
      score -= 0.2; // Too many steps
    }

    return {
      metric: 'step_efficiency',
      score: this.normalizeScore(score),
      rationale: `Solution used ${actualSteps} steps for a problem requiring approximately ${expectedSteps} steps.`,
      weight: 1.0,
    };
  }

  private evaluateCalculationAccuracy(response: MultiStepToolUsageResponse): MetricScore {
    let correctCalculations = 0;
    const totalCalculations = response.steps.length;

    // Basic validation of calculations
    response.steps.forEach((step) => {
      // Simple validation - in a real system, would execute the calculation
      if (step.result !== undefined && step.result !== null) {
        correctCalculations++;
      }
    });

    const score = totalCalculations > 0 ? correctCalculations / totalCalculations : 0;

    return {
      metric: 'calculation_accuracy',
      score,
      rationale: `${correctCalculations} out of ${totalCalculations} calculations appear valid.`,
      weight: 1.5,
    };
  }

  private evaluateExplanationQuality(
    testCase: TestCase,
    response: MultiStepToolUsageResponse,
  ): MetricScore {
    let score = 0.3; // Base score

    // Check explanation exists and has substance
    if (response.explanation && response.explanation.length > 20) {
      score += 0.2;
    }

    // Check if explanation references the steps
    const mentionsSteps = response.steps.some((step) =>
      response.explanation.toLowerCase().includes(step.description.toLowerCase().slice(0, 10)),
    );
    if (mentionsSteps) {
      score += 0.2;
    }

    // Check if explanation mentions the final answer
    if (response.explanation.includes(String(response.finalAnswer))) {
      score += 0.1;
    }

    // Check clarity indicators
    const clarityIndicators = ['first', 'then', 'finally', 'therefore', 'thus', 'so'];
    const hasClarityIndicators = clarityIndicators.some((indicator) =>
      response.explanation.toLowerCase().includes(indicator),
    );
    if (hasClarityIndicators) {
      score += 0.2;
    }

    return {
      metric: 'explanation_quality',
      score: this.normalizeScore(score),
      rationale:
        'Explanation quality assessed based on completeness, clarity, and connection to solution steps.',
      weight: 0.8,
    };
  }

  private generateFeedback(scores: MetricScore[], response: MultiStepToolUsageResponse): string {
    const feedback: string[] = [];

    // Overall performance
    const avgScore = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;
    if (avgScore >= 0.85) {
      feedback.push(
        'Excellent mathematical problem solving with clear steps and accurate results.',
      );
    } else if (avgScore >= 0.65) {
      feedback.push('Good problem solving approach with some areas for improvement.');
    } else {
      feedback.push('Solution needs improvement in accuracy or methodology.');
    }

    // Specific metric feedback
    const answerScore = scores.find((s) => s.metric === 'answer_correctness');
    if (answerScore && answerScore.score < 0.9) {
      feedback.push('Check the final answer for accuracy.');
    }

    const efficiencyScore = scores.find((s) => s.metric === 'step_efficiency');
    if (efficiencyScore && efficiencyScore.score < 0.7) {
      feedback.push('Consider optimizing the solution steps.');
    }

    // Summary
    feedback.push(
      `Solution completed in ${response.steps.length} steps with ${response.toolsUsed.length} different tools.`,
    );

    return feedback.join(' ');
  }

  private getScenarios(complexity?: 'simple' | 'moderate' | 'complex') {
    const baseScenarios = [
      {
        category: 'arithmetic',
        input: {
          problem: 'Calculate the total cost of 5 items at $12.99 each with a 10% discount.',
          requiresSteps: ['multiply quantity by price', 'calculate discount', 'subtract discount'],
          allowedTools: ['multiply', 'divide', 'subtract'],
        },
        expectedBehavior: [
          'Calculates item subtotal',
          'Applies percentage discount correctly',
          'Provides final total',
          'Shows clear calculation steps',
        ],
        expectedAnswer: 58.46,
      },
      {
        category: 'geometry',
        input: {
          problem: 'Find the area of a circle with radius 7 units. Use π = 3.14159.',
          requiresSteps: ['square the radius', 'multiply by pi'],
          allowedTools: ['power', 'multiply'],
        },
        expectedBehavior: [
          'Correctly squares the radius',
          'Uses provided π value',
          'Calculates area accurately',
          'Explains the formula used',
        ],
        expectedAnswer: 153.94,
      },
      {
        category: 'percentage',
        input: {
          problem: 'What is 35% of 280?',
          requiresSteps: ['convert percentage to decimal', 'multiply'],
        },
        expectedBehavior: [
          'Converts percentage correctly',
          'Performs multiplication',
          'Provides clear answer',
          'Shows conversion step',
        ],
        expectedAnswer: 98,
      },
      {
        category: 'compound',
        input: {
          problem:
            'A store offers 20% off, then an additional 15% off the sale price. What is the final price of a $100 item?',
          requiresSteps: [
            'calculate first discount',
            'apply to price',
            'calculate second discount',
            'apply to sale price',
          ],
        },
        expectedBehavior: [
          'Applies discounts sequentially',
          'Calculates intermediate price',
          'Shows both discount calculations',
          'Provides final price',
        ],
        expectedAnswer: 68,
      },
    ];

    // Adjust scenarios based on complexity
    if (complexity === 'simple') {
      return baseScenarios.filter(
        (s) => s.category === 'arithmetic' || s.category === 'percentage',
      );
    } else if (complexity === 'complex') {
      return [
        ...baseScenarios,
        {
          category: 'physics',
          input: {
            problem:
              'A ball is thrown upward with initial velocity 20 m/s. What is the maximum height? (g = 9.8 m/s²)',
            requiresSteps: [
              'identify kinematic equation',
              'calculate v²',
              'divide by 2g',
              'find height',
            ],
          },
          expectedBehavior: [
            'Uses correct physics formula',
            'Performs calculations accurately',
            'Shows all steps clearly',
            'Includes units in answer',
          ],
          expectedAnswer: 20.41,
        },
      ];
    }

    return baseScenarios;
  }
}
