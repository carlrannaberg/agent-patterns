import { Injectable } from '@nestjs/common';
import { PatternEvaluatorBase } from './pattern-evaluator.base';
import { AgentPattern } from '../enums/agent-pattern.enum';
import {
  TestCase,
  EvaluationResult,
  EvaluationConfig,
  MetricScore,
} from '../interfaces/evaluation.interface';

interface SequentialProcessingInput {
  product: string;
  targetAudience: string;
  brandTone: string;
  requirements?: string[];
}

interface SequentialProcessingResponse {
  initialCopy: string;
  refinedCopy: string;
  finalCopy: string;
  iterations: Array<{
    version: string;
    feedback: string;
    improvements: string[];
  }>;
}

@Injectable()
export class SequentialProcessingEvaluator extends PatternEvaluatorBase {
  pattern = AgentPattern.SEQUENTIAL_PROCESSING;

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
    response: SequentialProcessingResponse,
    config: EvaluationConfig,
  ): Promise<EvaluationResult> {
    const scores: MetricScore[] = [];

    // Content Quality
    if (config.metrics.some(m => m.name === 'content_quality')) {
      const contentScore = await this.evaluateContentQuality(testCase, response);
      scores.push(contentScore);
    }

    // Call to Action
    if (config.metrics.some(m => m.name === 'call_to_action')) {
      const ctaScore = this.evaluateCallToAction(response);
      scores.push(ctaScore);
    }

    // Emotional Appeal
    if (config.metrics.some(m => m.name === 'emotional_appeal')) {
      const emotionalScore = this.evaluateEmotionalAppeal(testCase, response);
      scores.push(emotionalScore);
    }

    // Clarity
    if (config.metrics.some(m => m.name === 'clarity')) {
      const clarityScore = this.evaluateClarity(response);
      scores.push(clarityScore);
    }

    // Iteration Effectiveness
    const iterationScore = this.evaluateIterationEffectiveness(response);
    scores.push(iterationScore);

    const overallScore = this.calculateWeightedScore(scores);
    const passed = overallScore >= 0.7;

    return {
      testCaseId: testCase.id,
      pattern: this.pattern,
      judgeModel: config.judgeModel,
      metricScores: scores,
      overallScore,
      pass: passed,
      executionTimeMs: 0,
      timestamp: new Date(),
      details: {
        actualOutput: response,
        chainOfThought: [this.generateFeedback(scores, response)],
      },
    };
  }

  getEvaluationPrompt(
    metric: string,
    testCase: TestCase,
    response: SequentialProcessingResponse,
  ): string {
    const input = testCase.input as SequentialProcessingInput;

    switch (metric) {
      case 'content_quality':
        return `Evaluate the quality of the marketing copy for the following product:
Product: ${input.product}
Target Audience: ${input.targetAudience}
Brand Tone: ${input.brandTone}

Final Copy:
${response.finalCopy}

Evaluation Criteria:
1. Relevance to the product and target audience
2. Creativity and originality
3. Brand alignment
4. Persuasiveness
5. Clarity of message

Provide a score from 0-1 and detailed rationale.`;

      case 'call_to_action':
        return `Evaluate the effectiveness of the call-to-action in the following marketing copy:

Final Copy:
${response.finalCopy}

Evaluation Criteria:
1. Presence of clear CTA
2. Action-oriented language
3. Urgency or incentive
4. Placement and visibility
5. Alignment with product offering

Provide a score from 0-1 and detailed rationale.`;

      case 'emotional_appeal':
        return `Evaluate the emotional appeal of the marketing copy:

Target Audience: ${input.targetAudience}
Final Copy:
${response.finalCopy}

Evaluation Criteria:
1. Connection with target audience emotions
2. Use of storytelling or narrative
3. Aspirational elements
4. Trust-building language
5. Memorability

Provide a score from 0-1 and detailed rationale.`;

      case 'clarity':
        return `Evaluate the clarity of the marketing copy:

Final Copy:
${response.finalCopy}

Evaluation Criteria:
1. Simple and concise language
2. Clear value proposition
3. Logical flow
4. Absence of jargon (unless appropriate)
5. Easy to scan and understand

Provide a score from 0-1 and detailed rationale.`;

      default:
        return '';
    }
  }

  private async evaluateContentQuality(
    testCase: TestCase,
    response: SequentialProcessingResponse,
  ): Promise<MetricScore> {
    const input = testCase.input as SequentialProcessingInput;
    let score = 0;

    // Check relevance to product
    if (response.finalCopy.toLowerCase().includes(input.product.toLowerCase())) {
      score += 0.2;
    }

    // Check target audience mention
    const audienceKeywords = input.targetAudience.toLowerCase().split(' ');
    const audienceRelevance = audienceKeywords.some((keyword) =>
      response.finalCopy.toLowerCase().includes(keyword),
    );
    if (audienceRelevance) {
      score += 0.2;
    }

    // Check brand tone alignment
    score += this.assessBrandToneAlignment(input.brandTone, response.finalCopy) * 0.3;

    // Check for key marketing elements
    const hasbenefits = /benefit|advantage|feature|help|improve/i.test(response.finalCopy);
    if (hasbenefits) {
      score += 0.15;
    }

    // Check copy length and structure
    const wordCount = response.finalCopy.split(' ').length;
    if (wordCount >= 30 && wordCount <= 150) {
      score += 0.15;
    }

    return {
      metric: 'content_quality',
      score: this.normalizeScore(score),
      normalizedScore: this.normalizeScore(score),
      reasoning: `Content quality assessed based on relevance, audience targeting, brand alignment, and structure.`,
    };
  }

  private evaluateCallToAction(response: SequentialProcessingResponse): MetricScore {
    let score = 0;
    const ctaPatterns = [
      /buy now/i,
      /shop today/i,
      /get yours/i,
      /order today/i,
      /learn more/i,
      /discover/i,
      /try it/i,
      /sign up/i,
      /get started/i,
      /claim your/i,
    ];

    // Check for CTA presence
    const hasCTA = ctaPatterns.some((pattern) => pattern.test(response.finalCopy));
    if (hasCTA) {
      score += 0.4;
    }

    // Check for urgency
    const urgencyPatterns = /limited|today|now|exclusive|special|offer|sale/i;
    if (urgencyPatterns.test(response.finalCopy)) {
      score += 0.3;
    }

    // Check for action verbs
    const actionVerbs = /get|buy|shop|try|discover|explore|claim|save|join/i;
    if (actionVerbs.test(response.finalCopy)) {
      score += 0.3;
    }

    return {
      metric: 'call_to_action',
      score: this.normalizeScore(score),
      normalizedScore: this.normalizeScore(score),
      reasoning: `CTA effectiveness evaluated based on presence, urgency, and action-oriented language.`,
    };
  }

  private evaluateEmotionalAppeal(
    testCase: TestCase,
    response: SequentialProcessingResponse,
  ): MetricScore {
    const input = testCase.input as SequentialProcessingInput;
    let score = 0;

    // Emotional language patterns
    const emotionalPatterns = {
      positive: /love|amazing|perfect|dream|wonderful|exciting|joy|happy|delight/i,
      aspirational: /achieve|succeed|transform|elevate|empower|inspire|unlock/i,
      trust: /trust|reliable|proven|guaranteed|authentic|genuine|quality/i,
      community: /join|together|community|family|belong|share/i,
    };

    // Check for emotional language
    Object.values(emotionalPatterns).forEach((pattern) => {
      if (pattern.test(response.finalCopy)) {
        score += 0.2;
      }
    });

    // Check for storytelling elements
    const hasStory = /imagine|picture|feel|experience|journey/i.test(response.finalCopy);
    if (hasStory) {
      score += 0.2;
    }

    return {
      metric: 'emotional_appeal',
      score: this.normalizeScore(score),
      normalizedScore: this.normalizeScore(score),
      reasoning: `Emotional appeal measured through use of emotional language, storytelling, and connection with audience.`,
    };
  }

  private evaluateClarity(response: SequentialProcessingResponse): MetricScore {
    let score = 0.5; // Base score

    // Check sentence length
    const sentences = response.finalCopy.split(/[.!?]+/).filter((s) => s.trim());
    const avgWordPerSentence =
      sentences.reduce((sum, s) => sum + s.split(' ').length, 0) / sentences.length;

    if (avgWordPerSentence <= 20) {
      score += 0.2;
    }

    // Check for simple language (absence of complex words)
    const complexWordPattern = /\b\w{10,}\b/g;
    const complexWords = response.finalCopy.match(complexWordPattern) || [];
    if (complexWords.length < 3) {
      score += 0.15;
    }

    // Check for clear structure
    const hasBulletPoints = /[•\-*]\s/m.test(response.finalCopy);
    const hasParagraphs = response.finalCopy.split('\n\n').length > 1;
    if (hasBulletPoints || hasParagraphs) {
      score += 0.15;
    }

    return {
      metric: 'clarity',
      score: this.normalizeScore(score),
      normalizedScore: this.normalizeScore(score),
      reasoning: `Clarity assessed through sentence structure, vocabulary simplicity, and formatting.`,
    };
  }

  private evaluateIterationEffectiveness(response: SequentialProcessingResponse): MetricScore {
    let score = 0;

    // Check if iterations exist
    if (!response.iterations || response.iterations.length === 0) {
      return {
        metric: 'iteration_effectiveness',
        score: 0,
        normalizedScore: 0,
        reasoning: 'No iterations found in the response.',
      };
    }

    // Check for progressive improvement
    const hasImprovements = response.iterations.every(
      (iteration) => iteration.improvements && iteration.improvements.length > 0,
    );
    if (hasImprovements) {
      score += 0.4;
    }

    // Check for meaningful feedback
    const hasFeedback = response.iterations.every(
      (iteration) => iteration.feedback && iteration.feedback.length > 20,
    );
    if (hasFeedback) {
      score += 0.3;
    }

    // Check if final copy is different from initial
    if (response.finalCopy !== response.initialCopy) {
      score += 0.3;
    }

    return {
      metric: 'iteration_effectiveness',
      score: this.normalizeScore(score),
      normalizedScore: this.normalizeScore(score),
      reasoning: `Iteration effectiveness measured by presence of improvements, feedback quality, and evolution of copy.`,
    };
  }

  private assessBrandToneAlignment(brandTone: string, copy: string): number {
    const toneLower = brandTone.toLowerCase();
    let alignment = 0.5; // Base score

    const tonePatterns: Record<string, RegExp> = {
      professional: /expert|professional|solution|enterprise|comprehensive|strategic/i,
      casual: /hey|cool|awesome|chill|fun|easy/i,
      luxury: /exclusive|premium|sophisticated|elegant|refined|exquisite/i,
      playful: /fun|play|enjoy|exciting|adventure|discover/i,
      authoritative: /leading|trusted|proven|industry|expert|guarantee/i,
    };

    // Find matching tone pattern
    for (const [tone, pattern] of Object.entries(tonePatterns)) {
      if (toneLower.includes(tone) && pattern.test(copy)) {
        alignment = 0.8;
        break;
      }
    }

    return alignment;
  }

  private generateFeedback(scores: MetricScore[], response: SequentialProcessingResponse): string {
    const feedback: string[] = [];

    // Overall performance
    const avgScore = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;
    if (avgScore >= 0.8) {
      feedback.push('Excellent marketing copy with strong performance across all metrics.');
    } else if (avgScore >= 0.6) {
      feedback.push('Good marketing copy with room for improvement in some areas.');
    } else {
      feedback.push('Marketing copy needs significant improvement.');
    }

    // Specific metric feedback
    scores.forEach((score) => {
      if (score.score < 0.6) {
        feedback.push(`${score.metric}: ${score.reasoning || 'No reasoning provided'}`);
      }
    });

    // Iteration feedback
    if (response.iterations && response.iterations.length > 0) {
      feedback.push(`Copy was refined through ${response.iterations.length} iterations.`);
    }

    return feedback.join(' ');
  }

  private getScenarios(complexity?: 'simple' | 'moderate' | 'complex') {
    const baseScenarios = [
      {
        category: 'technology',
        input: {
          product: 'SmartHome Hub',
          targetAudience: 'tech-savvy homeowners',
          brandTone: 'innovative and approachable',
          requirements: ['highlight convenience', 'emphasize security', 'mention compatibility'],
        },
        expectedBehavior: [
          'Creates compelling copy highlighting smart home benefits',
          'Iteratively refines message for clarity',
          'Includes strong call-to-action',
          'Maintains innovative yet approachable tone',
        ],
      },
      {
        category: 'fashion',
        input: {
          product: 'Eco-Friendly Sneakers',
          targetAudience: 'environmentally conscious millennials',
          brandTone: 'sustainable and trendy',
          requirements: ['emphasize sustainability', 'highlight style', 'mention comfort'],
        },
        expectedBehavior: [
          'Balances environmental message with fashion appeal',
          'Refines copy to resonate with target demographic',
          'Creates urgency without compromising brand values',
          'Uses contemporary language',
        ],
      },
      {
        category: 'food',
        input: {
          product: 'Organic Meal Prep Service',
          targetAudience: 'busy professionals',
          brandTone: 'healthy and convenient',
          requirements: ['stress time-saving', 'highlight nutrition', 'mention variety'],
        },
        expectedBehavior: [
          'Addresses pain points of busy lifestyle',
          'Emphasizes health benefits clearly',
          'Creates appetizing descriptions',
          'Includes clear ordering instructions',
        ],
      },
    ];

    // Adjust scenarios based on complexity
    if (complexity === 'simple') {
      return baseScenarios.map((scenario) => ({
        ...scenario,
        input: {
          ...scenario.input,
          requirements: scenario.input.requirements.slice(0, 1),
        },
      }));
    } else if (complexity === 'complex') {
      return baseScenarios.map((scenario) => ({
        ...scenario,
        input: {
          ...scenario.input,
          requirements: [
            ...scenario.input.requirements,
            'include social proof',
            'address objections',
            'create urgency',
          ],
        },
      }));
    }

    return baseScenarios;
  }
}
