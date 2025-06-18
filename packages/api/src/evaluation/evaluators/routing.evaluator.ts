import { Injectable } from '@nestjs/common';
import { PatternEvaluatorBase } from './pattern-evaluator.base';
import { AgentPattern } from '../enums/agent-pattern.enum';
import {
  TestCase,
  EvaluationResult,
  EvaluationConfig,
  MetricScore,
} from '../interfaces/evaluation.interface';

interface RoutingInput {
  query: string;
  customerId?: string;
  context?: string;
}

interface RoutingResponse {
  classification: string;
  confidence: number;
  routedTo: string;
  response: string;
  reasoning?: string;
}

@Injectable()
export class RoutingEvaluator extends PatternEvaluatorBase {
  pattern = AgentPattern.ROUTING;

  private readonly departments = ['technical', 'billing', 'general', 'complaints'];

  generateTestCases(count: number, complexity?: 'simple' | 'moderate' | 'complex'): TestCase[] {
    const testCases: TestCase[] = [];
    const scenarios = this.getScenarios(complexity);

    for (let i = 0; i < count; i++) {
      const scenario = scenarios[i % scenarios.length];
      testCases.push(
        this.generateBaseTestCase(this.pattern, scenario.input, scenario.expectedBehavior, {
          complexity,
          expectedDepartment: scenario.expectedDepartment,
          category: scenario.category,
        }),
      );
    }

    return testCases;
  }

  async evaluateResponse(
    testCase: TestCase,
    response: RoutingResponse,
    config: EvaluationConfig,
  ): Promise<EvaluationResult> {
    const scores: MetricScore[] = [];

    // Classification Accuracy
    if (config.metrics.includes('classification_accuracy')) {
      const classificationScore = this.evaluateClassificationAccuracy(testCase, response);
      scores.push(classificationScore);
    }

    // Routing Appropriateness
    if (config.metrics.includes('routing_appropriateness')) {
      const routingScore = this.evaluateRoutingAppropriateness(testCase, response);
      scores.push(routingScore);
    }

    // Response Relevance
    if (config.metrics.includes('response_relevance')) {
      const relevanceScore = this.evaluateResponseRelevance(testCase, response);
      scores.push(relevanceScore);
    }

    // Confidence Assessment
    const confidenceScore = this.evaluateConfidenceAlignment(response);
    scores.push(confidenceScore);

    // Fallback Handling
    const fallbackScore = this.evaluateFallbackHandling(testCase, response);
    scores.push(fallbackScore);

    const overallScore = this.calculateWeightedScore(scores);
    const passed = overallScore >= (config.passingThreshold || 0.75);

    return {
      testCaseId: testCase.id,
      pattern: this.pattern,
      scores,
      overallScore,
      passed,
      feedback: this.generateFeedback(scores, response, testCase),
      timestamp: new Date().toISOString(),
    };
  }

  getEvaluationPrompt(metric: string, testCase: TestCase, response: RoutingResponse): string {
    const input = testCase.input as RoutingInput;

    switch (metric) {
      case 'classification_accuracy':
        return `Evaluate the accuracy of the query classification:

Customer Query: ${input.query}
${input.context ? `Context: ${input.context}` : ''}

Classification: ${response.classification}
Routed To: ${response.routedTo}
${response.reasoning ? `Reasoning: ${response.reasoning}` : ''}

Expected Department: ${testCase.metadata?.expectedDepartment || 'Not specified'}

Evaluation Criteria:
1. Correct identification of query type
2. Appropriate department selection
3. Consideration of context clues
4. Handling of ambiguous queries
5. Consistency in classification

Provide a score from 0-1 and detailed rationale.`;

      case 'routing_appropriateness':
        return `Evaluate the appropriateness of the routing decision:

Query: ${input.query}
Routed To: ${response.routedTo}
Confidence: ${response.confidence}

Evaluation Criteria:
1. Match between query content and department expertise
2. Consideration of urgency or priority
3. Avoidance of unnecessary escalation
4. Appropriate use of specialized departments
5. Fallback handling for edge cases

Provide a score from 0-1 and detailed rationale.`;

      case 'response_relevance':
        return `Evaluate the relevance of the response provided:

Customer Query: ${input.query}
Response: ${response.response}

Evaluation Criteria:
1. Direct addressing of customer concern
2. Completeness of information
3. Appropriate level of detail
4. Clarity and understandability
5. Professional tone

Provide a score from 0-1 and detailed rationale.`;

      default:
        return '';
    }
  }

  private evaluateClassificationAccuracy(
    testCase: TestCase,
    response: RoutingResponse,
  ): MetricScore {
    const expectedDepartment = testCase.metadata?.expectedDepartment;
    let score = 0;

    // Check if routed to expected department
    if (expectedDepartment && response.routedTo === expectedDepartment) {
      score = 0.8;
    } else if (this.isAcceptableAlternative(expectedDepartment, response.routedTo)) {
      score = 0.6;
    } else {
      score = 0.2;
    }

    // Adjust based on confidence alignment
    if (response.confidence >= 0.8 && score >= 0.8) {
      score += 0.1;
    } else if (response.confidence <= 0.5 && score <= 0.5) {
      score += 0.1; // Appropriate low confidence for unclear routing
    }

    // Check for valid classification
    if (this.departments.includes(response.routedTo)) {
      score += 0.1;
    }

    return {
      metric: 'classification_accuracy',
      score: this.normalizeScore(score),
      rationale: `Classification accuracy based on expected department match and confidence alignment.`,
      weight: 1.5,
    };
  }

  private evaluateRoutingAppropriateness(
    testCase: TestCase,
    response: RoutingResponse,
  ): MetricScore {
    const input = testCase.input as RoutingInput;
    let score = 0.5; // Base score

    // Check for technical keywords
    const technicalKeywords =
      /error|bug|crash|install|update|software|hardware|connection|network/i;
    const isTechnical = technicalKeywords.test(input.query);
    if (isTechnical && response.routedTo === 'technical') {
      score += 0.3;
    }

    // Check for billing keywords
    const billingKeywords = /bill|payment|charge|refund|subscription|cancel|invoice|fee/i;
    const isBilling = billingKeywords.test(input.query);
    if (isBilling && response.routedTo === 'billing') {
      score += 0.3;
    }

    // Check for complaint keywords
    const complaintKeywords = /complaint|unhappy|dissatisfied|terrible|worst|angry|frustrated/i;
    const isComplaint = complaintKeywords.test(input.query);
    if (isComplaint && response.routedTo === 'complaints') {
      score += 0.3;
    }

    // Penalize obvious misrouting
    if (
      (isTechnical && response.routedTo === 'billing') ||
      (isBilling && response.routedTo === 'technical')
    ) {
      score -= 0.3;
    }

    // Check for reasoning
    if (response.reasoning && response.reasoning.length > 20) {
      score += 0.2;
    }

    return {
      metric: 'routing_appropriateness',
      score: this.normalizeScore(score),
      rationale: `Routing appropriateness evaluated based on query content and department match.`,
      weight: 1.3,
    };
  }

  private evaluateResponseRelevance(testCase: TestCase, response: RoutingResponse): MetricScore {
    const input = testCase.input as RoutingInput;
    let score = 0.3; // Base score

    // Check if response addresses the query
    const queryWords = input.query
      .toLowerCase()
      .split(' ')
      .filter((word) => word.length > 3);
    const responseWords = response.response.toLowerCase();

    const relevantWords = queryWords.filter((word) => responseWords.includes(word));
    const relevanceRatio = relevantWords.length / queryWords.length;
    score += relevanceRatio * 0.3;

    // Check response length
    const responseLength = response.response.split(' ').length;
    if (responseLength >= 20 && responseLength <= 150) {
      score += 0.2;
    }

    // Check for department-specific language
    if (this.hasDepartmentSpecificLanguage(response.routedTo, response.response)) {
      score += 0.2;
    }

    return {
      metric: 'response_relevance',
      score: this.normalizeScore(score),
      rationale: `Response relevance measured by query addressing and appropriate content.`,
      weight: 1.2,
    };
  }

  private evaluateConfidenceAlignment(response: RoutingResponse): MetricScore {
    let score = 0.5;

    // Check if confidence is within valid range
    if (response.confidence >= 0 && response.confidence <= 1) {
      score += 0.2;
    }

    // Check if confidence aligns with clear routing
    const clearDepartmentKeywords = {
      technical: /error|bug|crash|not working/i,
      billing: /bill|payment|charge|refund/i,
      complaints: /complaint|terrible|worst/i,
    };

    let hasCllearMatch = false;
    for (const [dept, pattern] of Object.entries(clearDepartmentKeywords)) {
      if (response.routedTo === dept && pattern.test(response.response)) {
        hasCllearMatch = true;
        break;
      }
    }

    if (hasCllearMatch && response.confidence >= 0.8) {
      score += 0.3;
    } else if (!hasCllearMatch && response.confidence <= 0.6) {
      score += 0.3; // Appropriate uncertainty
    }

    return {
      metric: 'confidence_alignment',
      score: this.normalizeScore(score),
      rationale: `Confidence score appropriately reflects routing certainty.`,
      weight: 0.8,
    };
  }

  private evaluateFallbackHandling(testCase: TestCase, response: RoutingResponse): MetricScore {
    const input = testCase.input as RoutingInput;
    let score = 0.7; // Base score - assume most routing is okay

    // Check for ambiguous queries
    const isAmbiguous = this.isAmbiguousQuery(input.query);

    if (isAmbiguous) {
      // For ambiguous queries, general routing or low confidence is good
      if (response.routedTo === 'general' || response.confidence <= 0.6) {
        score = 0.9;
      } else if (response.confidence >= 0.9) {
        score = 0.3; // Too confident for ambiguous query
      }
    }

    // Check for explicit fallback language
    const hasFallbackLanguage = /general inquiry|assist you further|help you with|clarify/i.test(
      response.response,
    );
    if (response.routedTo === 'general' && hasFallbackLanguage) {
      score += 0.1;
    }

    return {
      metric: 'fallback_handling',
      score: this.normalizeScore(score),
      rationale: `Fallback handling evaluated for ambiguous queries and edge cases.`,
      weight: 0.7,
    };
  }

  private isAcceptableAlternative(expected: string, actual: string): boolean {
    const alternatives: Record<string, string[]> = {
      technical: ['general'],
      billing: ['general', 'complaints'],
      complaints: ['general'],
      general: ['technical', 'billing'],
    };

    return alternatives[expected]?.includes(actual) || false;
  }

  private hasDepartmentSpecificLanguage(department: string, response: string): boolean {
    const departmentLanguage: Record<string, RegExp> = {
      technical: /troubleshoot|diagnostic|configuration|system|update|fix/i,
      billing: /account|invoice|payment method|transaction|balance/i,
      complaints: /apologize|sorry|understand your frustration|escalate|resolve/i,
      general: /assist|help|information|question|inquiry/i,
    };

    return departmentLanguage[department]?.test(response) || false;
  }

  private isAmbiguousQuery(query: string): boolean {
    const ambiguousPatterns = [
      /how do i/i,
      /can you help/i,
      /i need/i,
      /question about/i,
      /^hello/i,
      /^hi/i,
    ];

    const specificKeywords = /error|bill|payment|broken|complaint|refund|crash/i;

    const isAmbiguous = ambiguousPatterns.some((pattern) => pattern.test(query));
    const hasSpecifics = specificKeywords.test(query);

    return isAmbiguous && !hasSpecifics;
  }

  private generateFeedback(
    scores: MetricScore[],
    response: RoutingResponse,
    testCase: TestCase,
  ): string {
    const feedback: string[] = [];
    const avgScore = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;

    if (avgScore >= 0.85) {
      feedback.push('Excellent routing performance with accurate classification.');
    } else if (avgScore >= 0.7) {
      feedback.push('Good routing with minor areas for improvement.');
    } else {
      feedback.push('Routing needs improvement in accuracy or appropriateness.');
    }

    // Specific feedback
    const classificationScore = scores.find((s) => s.metric === 'classification_accuracy');
    if (classificationScore && classificationScore.score < 0.7) {
      feedback.push(
        `Routed to ${response.routedTo} but expected ${testCase.metadata?.expectedDepartment}.`,
      );
    }

    if (response.confidence < 0.5) {
      feedback.push('Low confidence score indicates uncertainty in routing decision.');
    }

    return feedback.join(' ');
  }

  private getScenarios(complexity?: 'simple' | 'moderate' | 'complex') {
    const baseScenarios = [
      // Technical scenarios
      {
        category: 'technical_clear',
        input: {
          query: 'My application keeps crashing when I try to save a file',
          customerId: 'CUST123',
        },
        expectedDepartment: 'technical',
        expectedBehavior: [
          'Routes to technical support',
          'High confidence score',
          'Provides initial troubleshooting response',
        ],
      },
      {
        category: 'technical_complex',
        input: {
          query: 'Getting error code 0x80004005 during installation',
          context: 'Windows 10, admin privileges',
        },
        expectedDepartment: 'technical',
        expectedBehavior: [
          'Routes to technical support',
          'Recognizes specific error code',
          'Technical response with next steps',
        ],
      },
      // Billing scenarios
      {
        category: 'billing_clear',
        input: {
          query: 'I was charged twice for my subscription this month',
          customerId: 'CUST456',
        },
        expectedDepartment: 'billing',
        expectedBehavior: [
          'Routes to billing department',
          'Acknowledges the double charge issue',
          'Provides information about refund process',
        ],
      },
      {
        category: 'billing_dispute',
        input: {
          query: 'I want to cancel my subscription and get a refund for unused time',
        },
        expectedDepartment: 'billing',
        expectedBehavior: [
          'Routes to billing department',
          'Addresses both cancellation and refund',
          'Professional handling of request',
        ],
      },
      // Complaint scenarios
      {
        category: 'complaint_clear',
        input: {
          query: 'This is the worst service I have ever experienced! I want to file a complaint.',
        },
        expectedDepartment: 'complaints',
        expectedBehavior: [
          'Routes to complaints department',
          'Acknowledges customer frustration',
          'De-escalation language in response',
        ],
      },
      // General/Ambiguous scenarios
      {
        category: 'general_ambiguous',
        input: {
          query: 'I have a question about your product',
        },
        expectedDepartment: 'general',
        expectedBehavior: [
          'Routes to general support',
          'Lower confidence score',
          'Asks for clarification',
        ],
      },
    ];

    if (complexity === 'simple') {
      return baseScenarios.filter(
        (s) => s.category.includes('clear') || s.category === 'general_ambiguous',
      );
    } else if (complexity === 'complex') {
      return [
        ...baseScenarios,
        {
          category: 'mixed_technical_billing',
          input: {
            query: 'The payment system crashes every time I try to update my credit card',
            context: 'Has active subscription',
          },
          expectedDepartment: 'technical', // Could also be billing
          expectedBehavior: [
            'Routes to either technical or billing',
            'Acknowledges both aspects',
            'May suggest escalation',
          ],
        },
        {
          category: 'urgent_ambiguous',
          input: {
            query: 'URGENT: Need immediate help!!!',
            customerId: 'VIP001',
          },
          expectedDepartment: 'general',
          expectedBehavior: [
            'Recognizes urgency',
            'Routes appropriately or escalates',
            'Requests more information',
          ],
        },
      ];
    }

    return baseScenarios;
  }
}
