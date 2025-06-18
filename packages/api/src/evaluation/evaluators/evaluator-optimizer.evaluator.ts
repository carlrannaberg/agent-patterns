import { Injectable } from '@nestjs/common';
import { PatternEvaluatorBase } from './pattern-evaluator.base';
import { AgentPattern } from '../enums/agent-pattern.enum';
import {
  TestCase,
  EvaluationResult,
  EvaluationConfig,
  MetricScore,
} from '../interfaces/evaluation.interface';

interface EvaluatorOptimizerInput {
  sourceText: string;
  targetLanguage: string;
  context?: string;
  preserveFormatting?: boolean;
}

interface EvaluatorOptimizerResponse {
  initialTranslation: string;
  evaluations: Array<{
    criteria: string;
    score: number;
    feedback: string;
  }>;
  optimizations: Array<{
    version: string;
    changes: string;
    improvements: string[];
  }>;
  finalTranslation: string;
  totalIterations: number;
}

@Injectable()
export class EvaluatorOptimizerEvaluator extends PatternEvaluatorBase {
  pattern = AgentPattern.EVALUATOR_OPTIMIZER;

  generateTestCases(count: number, complexity?: 'simple' | 'moderate' | 'complex'): TestCase[] {
    const testCases: TestCase[] = [];
    const scenarios = this.getScenarios(complexity);

    for (let i = 0; i < count; i++) {
      const scenario = scenarios[i % scenarios.length];
      testCases.push(
        this.generateBaseTestCase(this.pattern, scenario.input, scenario.expectedBehavior, {
          complexity,
          category: scenario.category,
        }),
      );
    }

    return testCases;
  }

  async evaluateResponse(
    testCase: TestCase,
    response: EvaluatorOptimizerResponse,
    config: EvaluationConfig,
  ): Promise<EvaluationResult> {
    const scores: MetricScore[] = [];

    // Translation Accuracy
    if (config.metrics.includes('translation_accuracy')) {
      const accuracyScore = this.evaluateTranslationAccuracy(testCase, response);
      scores.push(accuracyScore);
    }

    // Fluency and Naturalness
    if (config.metrics.includes('fluency')) {
      const fluencyScore = this.evaluateFluency(response);
      scores.push(fluencyScore);
    }

    // Iterative Improvement
    if (config.metrics.includes('iterative_improvement')) {
      const improvementScore = this.evaluateIterativeImprovement(response);
      scores.push(improvementScore);
    }

    // Cultural Appropriateness
    if (config.metrics.includes('cultural_appropriateness')) {
      const culturalScore = this.evaluateCulturalAppropriateness(testCase, response);
      scores.push(culturalScore);
    }

    // Context Preservation
    const contextScore = this.evaluateContextPreservation(testCase, response);
    scores.push(contextScore);

    const overallScore = this.calculateWeightedScore(scores);
    const passed = overallScore >= (config.passingThreshold || 0.75);

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
    response: EvaluatorOptimizerResponse,
  ): string {
    const input = testCase.input as EvaluatorOptimizerInput;

    switch (metric) {
      case 'translation_accuracy':
        return `Evaluate the accuracy of this translation:
Source Text: ${input.sourceText}
Target Language: ${input.targetLanguage}
Final Translation: ${response.finalTranslation}

Evaluation Criteria:
1. Semantic accuracy - Is the meaning preserved?
2. Completeness - Is all information translated?
3. No additions - Is there no extra information?
4. Terminology accuracy - Are technical terms correctly translated?
5. Grammar correctness in target language

Provide a score from 0-1 and detailed rationale.`;

      case 'fluency':
        return `Evaluate the fluency and naturalness of this ${input.targetLanguage} translation:
Translation: ${response.finalTranslation}

Evaluation Criteria:
1. Natural word choice and phrasing
2. Idiomatic expressions
3. Sentence flow and rhythm
4. Target language conventions
5. Readability

Provide a score from 0-1 and detailed rationale.`;

      case 'cultural_appropriateness':
        return `Evaluate the cultural appropriateness of this translation:
Source: ${input.sourceText}
Target Language: ${input.targetLanguage}
Context: ${input.context || 'General'}
Translation: ${response.finalTranslation}

Evaluation Criteria:
1. Cultural sensitivity
2. Appropriate formality level
3. Local conventions and customs
4. Avoidance of cultural faux pas
5. Target audience appropriateness

Provide a score from 0-1 and detailed rationale.`;

      case 'iterative_improvement':
        return `Evaluate the effectiveness of the iterative improvement process:
Initial Translation: ${response.initialTranslation}
Final Translation: ${response.finalTranslation}
Number of Iterations: ${response.totalIterations}

Evaluation Criteria:
1. Quality improvement from initial to final
2. Addressing of identified issues
3. Effectiveness of each iteration
4. Convergence to optimal translation
5. Efficiency of the process

Provide a score from 0-1 and detailed rationale.`;

      default:
        return '';
    }
  }

  private evaluateTranslationAccuracy(
    testCase: TestCase,
    response: EvaluatorOptimizerResponse,
  ): MetricScore {
    const input = testCase.input as EvaluatorOptimizerInput;
    let score = 0.5; // Base score

    // Check if translation exists and is different from source
    if (response.finalTranslation && response.finalTranslation !== input.sourceText) {
      score += 0.2;
    }

    // Check for completeness (rough approximation based on length)
    const sourceLength = input.sourceText.split(' ').length;
    const translationLength = response.finalTranslation.split(' ').length;
    const lengthRatio = Math.min(
      translationLength / sourceLength,
      sourceLength / translationLength,
    );
    if (lengthRatio > 0.7) {
      score += 0.2;
    }

    // Check if iterations improved the translation
    if (response.totalIterations > 1 && response.finalTranslation !== response.initialTranslation) {
      score += 0.1;
    }

    return {
      metric: 'translation_accuracy',
      score: this.normalizeScore(score),
      rationale:
        'Translation accuracy evaluated based on completeness, semantic preservation, and improvement through iterations.',
      weight: 1.5,
    };
  }

  private evaluateFluency(response: EvaluatorOptimizerResponse): MetricScore {
    let score = 0.5; // Base score

    // Check for natural sentence structure
    const sentences = response.finalTranslation.split(/[.!?]+/).filter((s) => s.trim());
    if (sentences.length > 0) {
      const avgWordsPerSentence = response.finalTranslation.split(' ').length / sentences.length;
      if (avgWordsPerSentence >= 5 && avgWordsPerSentence <= 25) {
        score += 0.2;
      }
    }

    // Check for improvements in fluency through iterations
    const fluencyImprovements = response.optimizations.some((opt) =>
      opt.improvements.some((imp) => /fluency|natural|smooth|flow|readable/i.test(imp)),
    );
    if (fluencyImprovements) {
      score += 0.2;
    }

    // Check evaluation scores for fluency
    const fluencyEval = response.evaluations.find((e) => /fluency|natural/i.test(e.criteria));
    if (fluencyEval && fluencyEval.score > 0.7) {
      score += 0.1;
    }

    return {
      metric: 'fluency',
      score: this.normalizeScore(score),
      rationale:
        'Fluency assessed through sentence structure, natural flow, and iterative improvements.',
      weight: 1.2,
    };
  }

  private evaluateIterativeImprovement(response: EvaluatorOptimizerResponse): MetricScore {
    let score = 0;

    // Check if iterations occurred
    if (response.totalIterations === 0 || !response.optimizations.length) {
      return {
        metric: 'iterative_improvement',
        score: 0,
        rationale: 'No iterative improvement process detected.',
        weight: 1.0,
      };
    }

    // Base score for having iterations
    score += 0.3;

    // Check if each iteration had meaningful improvements
    const meaningfulIterations = response.optimizations.filter(
      (opt) => opt.improvements && opt.improvements.length > 0,
    ).length;
    score += (meaningfulIterations / response.totalIterations) * 0.3;

    // Check if evaluations guided improvements
    const hasEvaluationFeedback = response.evaluations.every(
      (e) => e.feedback && e.feedback.length > 10,
    );
    if (hasEvaluationFeedback) {
      score += 0.2;
    }

    // Check if final is different from initial
    if (response.finalTranslation !== response.initialTranslation) {
      score += 0.2;
    }

    return {
      metric: 'iterative_improvement',
      score: this.normalizeScore(score),
      rationale: `Iterative process effectiveness measured across ${response.totalIterations} iterations with ${meaningfulIterations} meaningful improvements.`,
      weight: 1.0,
    };
  }

  private evaluateCulturalAppropriateness(
    testCase: TestCase,
    response: EvaluatorOptimizerResponse,
  ): MetricScore {
    const input = testCase.input as EvaluatorOptimizerInput;
    let score = 0.6; // Base score

    // Check if cultural considerations were mentioned in optimizations
    const culturalOptimizations = response.optimizations.some((opt) =>
      opt.improvements.some((imp) =>
        /cultur|formal|informal|polite|appropriate|local|custom/i.test(imp),
      ),
    );
    if (culturalOptimizations) {
      score += 0.2;
    }

    // Check if context was considered
    if (input.context && response.evaluations.some((e) => e.criteria.includes('context'))) {
      score += 0.1;
    }

    // Language-specific considerations
    const formalityLanguages = ['japanese', 'korean', 'german', 'french'];
    if (formalityLanguages.some((lang) => input.targetLanguage.toLowerCase().includes(lang))) {
      const formalityConsidered = response.optimizations.some((opt) =>
        /formal|polite|honorific/i.test(opt.changes),
      );
      if (formalityConsidered) {
        score += 0.1;
      }
    }

    return {
      metric: 'cultural_appropriateness',
      score: this.normalizeScore(score),
      rationale:
        'Cultural appropriateness evaluated based on context consideration and cultural adaptations.',
      weight: 0.8,
    };
  }

  private evaluateContextPreservation(
    testCase: TestCase,
    response: EvaluatorOptimizerResponse,
  ): MetricScore {
    const input = testCase.input as EvaluatorOptimizerInput;
    let score = 0.7; // Base score

    // Check if formatting was preserved when requested
    if (input.preserveFormatting) {
      const formatElements = ['"', "'", '(', ')', '[', ']', '!', '?'];
      const sourceFormatCount = formatElements.reduce(
        (count, elem) => count + (input.sourceText.split(elem).length - 1),
        0,
      );
      const translationFormatCount = formatElements.reduce(
        (count, elem) => count + (response.finalTranslation.split(elem).length - 1),
        0,
      );

      if (Math.abs(sourceFormatCount - translationFormatCount) <= 2) {
        score += 0.2;
      }
    }

    // Check if context influenced the translation
    if (input.context) {
      const contextRelevantOptimizations = response.optimizations.some((opt) =>
        opt.changes.toLowerCase().includes(input.context.toLowerCase()),
      );
      if (contextRelevantOptimizations) {
        score += 0.1;
      }
    }

    return {
      metric: 'context_preservation',
      score: this.normalizeScore(score),
      rationale: 'Context and formatting preservation evaluated based on input requirements.',
      weight: 0.7,
    };
  }

  private generateFeedback(scores: MetricScore[], response: EvaluatorOptimizerResponse): string {
    const feedback: string[] = [];

    // Overall performance
    const avgScore = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;
    if (avgScore >= 0.8) {
      feedback.push('Excellent translation with effective iterative optimization.');
    } else if (avgScore >= 0.6) {
      feedback.push('Good translation quality with some areas for improvement.');
    } else {
      feedback.push('Translation needs significant improvement.');
    }

    // Specific metric feedback
    scores.forEach((score) => {
      if (score.score < 0.6) {
        feedback.push(`${score.metric}: ${score.rationale}`);
      }
    });

    // Iteration summary
    feedback.push(`Translation refined through ${response.totalIterations} iterations.`);

    return feedback.join(' ');
  }

  private getScenarios(complexity?: 'simple' | 'moderate' | 'complex') {
    const baseScenarios = [
      {
        category: 'greeting',
        input: {
          sourceText: 'Hello, how are you today?',
          targetLanguage: 'Spanish',
          context: 'Casual greeting',
        },
        expectedBehavior: [
          'Translates greeting appropriately',
          'Considers formality level',
          'Iteratively improves naturalness',
          'Achieves idiomatic expression',
        ],
      },
      {
        category: 'business',
        input: {
          sourceText: 'We appreciate your business and look forward to our continued partnership.',
          targetLanguage: 'Japanese',
          context: 'Business correspondence',
          preserveFormatting: false,
        },
        expectedBehavior: [
          'Maintains formal business tone',
          'Uses appropriate honorifics',
          'Preserves professional sentiment',
          'Optimizes for cultural appropriateness',
        ],
      },
      {
        category: 'technical',
        input: {
          sourceText: 'Click the "Save" button to store your changes permanently.',
          targetLanguage: 'French',
          context: 'Software user interface',
          preserveFormatting: true,
        },
        expectedBehavior: [
          'Preserves technical accuracy',
          'Maintains UI conventions',
          'Keeps formatting elements',
          'Ensures clarity for users',
        ],
      },
      {
        category: 'literary',
        input: {
          sourceText:
            'The autumn leaves danced in the gentle breeze, painting the sky with golden hues.',
          targetLanguage: 'Chinese (Simplified)',
          context: 'Literary description',
        },
        expectedBehavior: [
          'Preserves poetic imagery',
          'Maintains literary style',
          'Adapts cultural metaphors',
          'Achieves aesthetic quality',
        ],
      },
    ];

    // Adjust scenarios based on complexity
    if (complexity === 'simple') {
      return baseScenarios.slice(0, 2).map((scenario) => ({
        ...scenario,
        input: {
          ...scenario.input,
          sourceText: scenario.input.sourceText.split('.')[0], // Shorter text
        },
      }));
    } else if (complexity === 'complex') {
      return baseScenarios.map((scenario) => ({
        ...scenario,
        input: {
          ...scenario.input,
          sourceText:
            scenario.input.sourceText +
            ' This requires careful consideration of cultural nuances and linguistic precision.',
        },
      }));
    }

    return baseScenarios;
  }
}
