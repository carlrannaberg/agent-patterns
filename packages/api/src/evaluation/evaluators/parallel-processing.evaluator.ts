import { Injectable } from '@nestjs/common';
import { PatternEvaluatorBase } from './pattern-evaluator.base';
import { AgentPattern } from '../enums/agent-pattern.enum';
import {
  TestCase,
  EvaluationResult,
  EvaluationConfig,
  MetricScore,
} from '../interfaces/evaluation.interface';

interface ParallelProcessingInput {
  code: string;
  language: string;
  context?: string;
  focusAreas?: string[];
}

interface CodeReviewAnalysis {
  category: string;
  findings: Array<{
    severity: 'high' | 'medium' | 'low';
    issue: string;
    line?: number;
    suggestion: string;
  }>;
  summary: string;
}

interface ParallelProcessingResponse {
  analyses: {
    security?: CodeReviewAnalysis;
    performance?: CodeReviewAnalysis;
    maintainability?: CodeReviewAnalysis;
    [key: string]: CodeReviewAnalysis | undefined;
  };
  overallSummary: string;
  prioritizedActions: string[];
  codeQualityScore?: number;
}

@Injectable()
export class ParallelProcessingEvaluator extends PatternEvaluatorBase {
  pattern = AgentPattern.PARALLEL_PROCESSING;

  generateTestCases(count: number, complexity?: 'simple' | 'moderate' | 'complex'): TestCase[] {
    const testCases: TestCase[] = [];
    const scenarios = this.getScenarios(complexity);

    for (let i = 0; i < count; i++) {
      const scenario = scenarios[i % scenarios.length];
      testCases.push(
        this.generateBaseTestCase(this.pattern, scenario.input, scenario.expectedBehavior, {
          complexity,
          category: scenario.category,
          expectedIssues: scenario.expectedIssues,
        }),
      );
    }

    return testCases;
  }

  async evaluateResponse(
    testCase: TestCase,
    response: ParallelProcessingResponse,
    config: EvaluationConfig,
  ): Promise<EvaluationResult> {
    const scores: MetricScore[] = [];

    // Analysis Completeness
    if (config.metrics.includes('analysis_completeness')) {
      const completenessScore = this.evaluateAnalysisCompleteness(testCase, response);
      scores.push(completenessScore);
    }

    // Consistency
    if (config.metrics.includes('consistency')) {
      const consistencyScore = this.evaluateConsistency(response);
      scores.push(consistencyScore);
    }

    // Aggregation Quality
    if (config.metrics.includes('aggregation_quality')) {
      const aggregationScore = this.evaluateAggregationQuality(response);
      scores.push(aggregationScore);
    }

    // Finding Accuracy
    const accuracyScore = this.evaluateFindingAccuracy(testCase, response);
    scores.push(accuracyScore);

    // Actionability
    const actionabilityScore = this.evaluateActionability(response);
    scores.push(actionabilityScore);

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
    response: ParallelProcessingResponse,
  ): string {
    const input = testCase.input as ParallelProcessingInput;

    switch (metric) {
      case 'analysis_completeness':
        return `Evaluate the completeness of the parallel code review analysis:

Code Language: ${input.language}
Focus Areas: ${input.focusAreas?.join(', ') || 'Security, Performance, Maintainability'}

Analyses Provided:
${Object.keys(response.analyses)
  .map((key) => `- ${key}: ${response.analyses[key]?.findings.length || 0} findings`)
  .join('\n')}

Evaluation Criteria:
1. Coverage of all requested focus areas
2. Depth of analysis in each area
3. Identification of relevant issues
4. Appropriate severity classification
5. Comprehensiveness of review

Provide a score from 0-1 and detailed rationale.`;

      case 'consistency':
        return `Evaluate the consistency across parallel analyses:

Overall Summary: ${response.overallSummary}

Individual Analyses:
${Object.entries(response.analyses)
  .map(([key, analysis]) => `${key}: ${analysis?.summary || 'No summary'}`)
  .join('\n\n')}

Evaluation Criteria:
1. Alignment between individual analyses
2. Consistent severity ratings for related issues
3. No contradictory findings
4. Coherent overall narrative
5. Unified recommendations

Provide a score from 0-1 and detailed rationale.`;

      case 'aggregation_quality':
        return `Evaluate the quality of aggregated results:

Overall Summary: ${response.overallSummary}
Prioritized Actions: ${response.prioritizedActions.join(', ')}
Total Findings: ${Object.values(response.analyses).reduce((sum, a) => sum + (a?.findings.length || 0), 0)}

Evaluation Criteria:
1. Effective synthesis of individual analyses
2. Clear prioritization of actions
3. Balanced representation of all areas
4. Actionable overall recommendations
5. Clear summary of key issues

Provide a score from 0-1 and detailed rationale.`;

      default:
        return '';
    }
  }

  private evaluateAnalysisCompleteness(
    testCase: TestCase,
    response: ParallelProcessingResponse,
  ): MetricScore {
    const input = testCase.input as ParallelProcessingInput;
    let score = 0;

    // Check coverage of default areas
    const defaultAreas = ['security', 'performance', 'maintainability'];
    const coveredAreas = defaultAreas.filter(
      (area) => response.analyses[area] && response.analyses[area].findings.length > 0,
    );
    score += (coveredAreas.length / defaultAreas.length) * 0.4;

    // Check if custom focus areas are covered
    if (input.focusAreas) {
      const customCovered = input.focusAreas.filter(
        (area) =>
          response.analyses[area.toLowerCase()] &&
          response.analyses[area.toLowerCase()]!.findings.length > 0,
      );
      score += (customCovered.length / input.focusAreas.length) * 0.3;
    }

    // Check depth of analysis (findings per area)
    const totalFindings = Object.values(response.analyses).reduce(
      (sum, analysis) => sum + (analysis?.findings.length || 0),
      0,
    );
    if (totalFindings >= 6) score += 0.2;
    else if (totalFindings >= 3) score += 0.1;

    // Check for summaries
    const hasSummaries = Object.values(response.analyses).every(
      (analysis) => analysis && analysis.summary && analysis.summary.length > 20,
    );
    if (hasSummaries) score += 0.1;

    return {
      metric: 'analysis_completeness',
      score: this.normalizeScore(score),
      rationale: `Completeness evaluated based on coverage of focus areas and depth of analysis.`,
      weight: 1.5,
    };
  }

  private evaluateConsistency(response: ParallelProcessingResponse): MetricScore {
    let score = 0.5; // Base score

    // Check for contradictory findings
    const allFindings = Object.values(response.analyses).flatMap(
      (analysis) => analysis?.findings || [],
    );

    // Look for issues that might be contradictory
    const hasContradictions = this.checkForContradictions(allFindings);
    if (!hasContradictions) {
      score += 0.3;
    }

    // Check severity consistency
    const severityConsistent = this.checkSeverityConsistency(response.analyses);
    if (severityConsistent) {
      score += 0.2;
    }

    // Check if prioritized actions align with findings
    if (response.prioritizedActions && response.prioritizedActions.length > 0) {
      const actionsAlignWithFindings = response.prioritizedActions.every((action) => {
        const actionLower = action.toLowerCase();
        return allFindings.some(
          (finding) =>
            finding.issue.toLowerCase().includes(actionLower.split(' ')[0]) ||
            finding.suggestion.toLowerCase().includes(actionLower.split(' ')[0]),
        );
      });
      if (actionsAlignWithFindings) {
        score += 0.2;
      }
    }

    return {
      metric: 'consistency',
      score: this.normalizeScore(score),
      rationale: `Consistency measured across parallel analyses and aggregated results.`,
      weight: 1.2,
    };
  }

  private evaluateAggregationQuality(response: ParallelProcessingResponse): MetricScore {
    let score = 0;

    // Check overall summary quality
    if (response.overallSummary && response.overallSummary.length > 50) {
      score += 0.3;

      // Check if summary mentions key areas
      const areas = Object.keys(response.analyses);
      const mentionedAreas = areas.filter((area) =>
        response.overallSummary.toLowerCase().includes(area),
      );
      score += (mentionedAreas.length / areas.length) * 0.2;
    }

    // Check prioritized actions
    if (response.prioritizedActions && response.prioritizedActions.length > 0) {
      score += 0.2;

      // Check if actions are actually prioritized (not just listed)
      const hasPriorityIndicators = response.prioritizedActions.some((action) =>
        /critical|high priority|immediate|urgent|important/i.test(action),
      );
      if (hasPriorityIndicators || response.prioritizedActions.length <= 5) {
        score += 0.1;
      }
    }

    // Check code quality score if provided
    if (
      response.codeQualityScore !== undefined &&
      response.codeQualityScore >= 0 &&
      response.codeQualityScore <= 100
    ) {
      score += 0.2;
    }

    return {
      metric: 'aggregation_quality',
      score: this.normalizeScore(score),
      rationale: `Aggregation quality based on synthesis, prioritization, and clarity.`,
      weight: 1.0,
    };
  }

  private evaluateFindingAccuracy(
    testCase: TestCase,
    response: ParallelProcessingResponse,
  ): MetricScore {
    const expectedIssues = testCase.metadata?.expectedIssues || [];
    let score = 0.3; // Base score

    // Check if expected issues are found
    const allFindings = Object.values(response.analyses).flatMap(
      (analysis) => analysis?.findings || [],
    );

    if (expectedIssues.length > 0) {
      const foundExpected = expectedIssues.filter((expected) =>
        allFindings.some(
          (finding) =>
            finding.issue.toLowerCase().includes(expected.toLowerCase()) ||
            finding.suggestion.toLowerCase().includes(expected.toLowerCase()),
        ),
      );
      score += (foundExpected.length / expectedIssues.length) * 0.4;
    }

    // Check for false positives (very basic check)
    const input = testCase.input as ParallelProcessingInput;
    const codeLines = input.code.split('\n').length;
    const findingsPerLine = allFindings.length / codeLines;

    if (findingsPerLine <= 0.5) {
      score += 0.2; // Not too many findings
    } else if (findingsPerLine <= 1) {
      score += 0.1;
    }

    // Check severity distribution
    const highSeverity = allFindings.filter((f) => f.severity === 'high').length;
    const totalFindings = allFindings.length;
    if (totalFindings > 0 && highSeverity / totalFindings <= 0.3) {
      score += 0.1; // Reasonable severity distribution
    }

    return {
      metric: 'finding_accuracy',
      score: this.normalizeScore(score),
      rationale: `Finding accuracy based on expected issues and reasonable distribution.`,
      weight: 1.3,
    };
  }

  private evaluateActionability(response: ParallelProcessingResponse): MetricScore {
    let score = 0;

    // Check if suggestions are provided
    const allFindings = Object.values(response.analyses).flatMap(
      (analysis) => analysis?.findings || [],
    );

    const findingsWithSuggestions = allFindings.filter(
      (f) => f.suggestion && f.suggestion.length > 10,
    );
    score += (findingsWithSuggestions.length / Math.max(allFindings.length, 1)) * 0.4;

    // Check if prioritized actions are actionable
    if (response.prioritizedActions && response.prioritizedActions.length > 0) {
      const actionablePatterns = /implement|add|remove|refactor|update|fix|change|improve/i;
      const actionableActions = response.prioritizedActions.filter((action) =>
        actionablePatterns.test(action),
      );
      score += (actionableActions.length / response.prioritizedActions.length) * 0.3;
    }

    // Check for specific line references
    const findingsWithLines = allFindings.filter((f) => f.line !== undefined);
    if (allFindings.length > 0) {
      score += (findingsWithLines.length / allFindings.length) * 0.3;
    }

    return {
      metric: 'actionability',
      score: this.normalizeScore(score),
      rationale: `Actionability measured by quality of suggestions and specific recommendations.`,
      weight: 0.9,
    };
  }

  private checkForContradictions(findings: Array<any>): boolean {
    // Simple contradiction detection
    const issues = findings.map((f) => f.issue.toLowerCase());

    // Look for opposing recommendations
    const hasOptimizeAndSimplify =
      issues.some((i) => i.includes('optimize')) && issues.some((i) => i.includes('simplify'));

    const hasAddAndRemove =
      issues.some((i) => i.includes('add')) &&
      issues.some((i) => i.includes('remove')) &&
      issues.filter((i) => i.includes('add') || i.includes('remove')).length > 1;

    return hasOptimizeAndSimplify || hasAddAndRemove;
  }

  private checkSeverityConsistency(analyses: any): boolean {
    // Check if similar issues have similar severities
    const allFindings = Object.values(analyses).flatMap(
      (analysis) => (analysis as any)?.findings || [],
    );

    // Group findings by similar issues
    const securityFindings = allFindings.filter(
      (f) =>
        f.issue.toLowerCase().includes('security') ||
        f.issue.toLowerCase().includes('vulnerability'),
    );

    if (securityFindings.length > 1) {
      const severities = securityFindings.map((f) => f.severity);
      // All security issues should have similar severity
      return new Set(severities).size <= 2;
    }

    return true;
  }

  private generateFeedback(scores: MetricScore[], response: ParallelProcessingResponse): string {
    const feedback: string[] = [];
    const avgScore = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;

    if (avgScore >= 0.85) {
      feedback.push('Excellent parallel analysis with comprehensive coverage.');
    } else if (avgScore >= 0.7) {
      feedback.push('Good analysis with minor areas for improvement.');
    } else {
      feedback.push('Analysis needs improvement in completeness or consistency.');
    }

    // Specific feedback
    const totalFindings = Object.values(response.analyses).reduce(
      (sum, a) => sum + (a?.findings.length || 0),
      0,
    );
    feedback.push(
      `Identified ${totalFindings} issues across ${Object.keys(response.analyses).length} categories.`,
    );

    if (response.prioritizedActions && response.prioritizedActions.length > 0) {
      feedback.push(`Provided ${response.prioritizedActions.length} prioritized actions.`);
    }

    return feedback.join(' ');
  }

  private getScenarios(complexity?: 'simple' | 'moderate' | 'complex') {
    const baseScenarios = [
      {
        category: 'web_api',
        input: {
          code: `
class UserController {
  async getUser(id) {
    const query = \`SELECT * FROM users WHERE id = \${id}\`;
    const result = await db.query(query);
    return result[0];
  }
  
  async updateUser(id, data) {
    const user = await this.getUser(id);
    Object.assign(user, data);
    await db.query(\`UPDATE users SET data = '\${JSON.stringify(user)}' WHERE id = \${id}\`);
    return user;
  }
}`,
          language: 'javascript',
          context: 'REST API controller',
        },
        expectedIssues: ['SQL injection', 'No input validation', 'No error handling'],
        expectedBehavior: [
          'Identifies SQL injection vulnerabilities',
          'Flags missing input validation',
          'Suggests parameterized queries',
          'Notes lack of error handling',
        ],
      },
      {
        category: 'algorithm',
        input: {
          code: `
def find_duplicates(arr):
    duplicates = []
    for i in range(len(arr)):
        for j in range(i + 1, len(arr)):
            if arr[i] == arr[j] and arr[i] not in duplicates:
                duplicates.append(arr[i])
    return duplicates

def process_large_dataset(data):
    results = []
    for item in data:
        processed = expensive_operation(item)
        if processed:
            results.append(processed)
    return results`,
          language: 'python',
          context: 'Data processing functions',
        },
        expectedIssues: ['O(n²) complexity', 'No caching', 'Memory inefficient'],
        expectedBehavior: [
          'Identifies performance issues with nested loops',
          'Suggests using sets for duplicate detection',
          'Recommends batch processing or generators',
          'Analyzes time complexity',
        ],
      },
      {
        category: 'react_component',
        input: {
          code: `
const UserProfile = ({ userId }) => {
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  
  useEffect(() => {
    fetch('/api/users/' + userId)
      .then(res => res.json())
      .then(data => setUser(data));
      
    fetch('/api/posts?user=' + userId)
      .then(res => res.json())
      .then(data => setPosts(data));
  }, []);
  
  return (
    <div>
      <h1>{user.name}</h1>
      {posts.map(post => <Post key={post.id} {...post} />)}
    </div>
  );
};`,
          language: 'javascript',
          context: 'React component',
        },
        expectedIssues: ['Missing dependency', 'No error handling', 'Potential null reference'],
        expectedBehavior: [
          'Identifies missing userId dependency in useEffect',
          'Flags potential null reference error',
          'Suggests error handling for API calls',
          'Recommends loading states',
        ],
      },
    ];

    if (complexity === 'simple') {
      return baseScenarios.map((scenario) => ({
        ...scenario,
        input: {
          ...scenario.input,
          code: scenario.input.code.split('\n').slice(0, 10).join('\n'),
        },
        expectedIssues: scenario.expectedIssues.slice(0, 1),
      }));
    } else if (complexity === 'complex') {
      return baseScenarios.map((scenario) => ({
        ...scenario,
        input: {
          ...scenario.input,
          focusAreas: ['security', 'performance', 'maintainability', 'testing', 'documentation'],
        },
        expectedIssues: [
          ...scenario.expectedIssues,
          'No tests',
          'Missing documentation',
          'Poor naming conventions',
        ],
      }));
    }

    return baseScenarios;
  }
}
