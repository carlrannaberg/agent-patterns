import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, In } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FailurePattern, EvaluationResult } from '../../database/entities';

interface FailureAnalysisResult {
  pattern: FailurePattern;
  similarFailures: EvaluationResult[];
  rootCauseHypotheses: Array<{
    cause: string;
    confidence: number;
    evidence: string[];
  }>;
  suggestedRemediations: Array<{
    action: string;
    priority: 'high' | 'medium' | 'low';
    estimatedEffort: 'low' | 'medium' | 'high';
  }>;
}

@Injectable()
export class FailureAnalysisService {
  private readonly logger = new Logger(FailureAnalysisService.name);

  constructor(
    @InjectRepository(FailurePattern)
    private failurePatternRepo: Repository<FailurePattern>,
    @InjectRepository(EvaluationResult)
    private evaluationResultRepo: Repository<EvaluationResult>,
  ) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async analyzeFailures(): Promise<void> {
    this.logger.log('Analyzing recent failures...');

    const recentFailures = await this.evaluationResultRepo.find({
      where: {
        success: false,
        createdAt: MoreThan(new Date(Date.now() - 30 * 60 * 1000)),
      },
      relations: ['metrics'],
    });

    for (const failure of recentFailures) {
      await this.categorizeAndStoreFailure(failure);
    }

    await this.performRootCauseAnalysis();
    await this.updateFailureStatuses();
  }

  async categorizeAndStoreFailure(evaluationResult: EvaluationResult): Promise<void> {
    const category = this.categorizeError(evaluationResult.error);
    const signature = this.generateErrorSignature(evaluationResult);

    let pattern = await this.failurePatternRepo.findOne({
      where: {
        patternType: evaluationResult.patternType,
        errorSignature: signature,
      },
    });

    if (pattern) {
      pattern.occurrenceCount++;
      pattern.lastSeen = new Date();

      if (pattern.exampleCases.length < 10) {
        pattern.exampleCases.push({
          testCaseId: evaluationResult.testCaseId,
          evaluationResultId: evaluationResult.id,
          timestamp: evaluationResult.createdAt,
          context: {
            input: evaluationResult.input,
            error: evaluationResult.error,
            metrics: evaluationResult.metrics.map((m) => ({
              name: m.name,
              score: m.score,
            })),
          },
        });
      }

      pattern.impactScore = this.calculateImpactScore(pattern);
    } else {
      pattern = this.failurePatternRepo.create({
        patternType: evaluationResult.patternType,
        category,
        subCategory: this.getSubCategory(evaluationResult.error),
        description: this.generateDescription(evaluationResult),
        errorSignature: signature,
        occurrenceCount: 1,
        exampleCases: [
          {
            testCaseId: evaluationResult.testCaseId,
            evaluationResultId: evaluationResult.id,
            timestamp: evaluationResult.createdAt,
            context: {
              input: evaluationResult.input,
              error: evaluationResult.error,
              metrics: evaluationResult.metrics.map((m) => ({
                name: m.name,
                score: m.score,
              })),
            },
          },
        ],
        impactScore: 0.5,
        status: 'active',
        firstSeen: evaluationResult.createdAt,
        lastSeen: evaluationResult.createdAt,
      });
    }

    await this.failurePatternRepo.save(pattern);
  }

  async getFailurePatterns(filters: {
    patternType?: string;
    status?: 'active' | 'resolved' | 'monitoring';
  }): Promise<FailurePattern[]> {
    const where: any = {};
    if (filters.patternType) where.patternType = filters.patternType;
    if (filters.status) where.status = filters.status;

    return this.failurePatternRepo.find({
      where,
      order: {
        impactScore: 'DESC',
        occurrenceCount: 'DESC',
      },
    });
  }

  async getFailureAnalysis(id: string): Promise<FailureAnalysisResult> {
    const pattern = await this.failurePatternRepo.findOne({
      where: { id },
    });

    if (!pattern) {
      throw new Error('Failure pattern not found');
    }

    const similarFailures = await this.findSimilarFailures(pattern);
    const rootCauseHypotheses = await this.generateRootCauseHypotheses(pattern);
    const suggestedRemediations = this.generateRemediations(pattern, rootCauseHypotheses);

    return {
      pattern,
      similarFailures,
      rootCauseHypotheses,
      suggestedRemediations,
    };
  }

  private async performRootCauseAnalysis(): Promise<void> {
    const activePatterns = await this.failurePatternRepo.find({
      where: { status: 'active' },
    });

    for (const pattern of activePatterns) {
      if (!pattern.rootCauseAnalysis || pattern.occurrenceCount % 10 === 0) {
        const commonFactors = await this.identifyCommonFactors(pattern);
        const rootCause = this.analyzeRootCause(pattern, commonFactors);

        pattern.commonFactors = commonFactors;
        pattern.rootCauseAnalysis = rootCause;

        await this.failurePatternRepo.save(pattern);
      }
    }
  }

  private async identifyCommonFactors(pattern: FailurePattern): Promise<any> {
    const factors = {
      inputPatterns: [],
      configPatterns: {},
      environmentFactors: [],
    };

    if (pattern.exampleCases.length < 3) {
      return factors;
    }

    // Analyze input patterns
    const inputs = pattern.exampleCases.map((c) => c.context.input);
    factors.inputPatterns = this.findCommonPatterns(inputs);

    // Analyze configuration patterns
    const configs = pattern.exampleCases.map((c) => c.context.config).filter(Boolean);
    if (configs.length > 0) {
      factors.configPatterns = this.findCommonProperties(configs);
    }

    // Analyze environmental factors
    const times = pattern.exampleCases.map((c) => new Date(c.timestamp));
    factors.environmentFactors = this.analyzeTemporalPatterns(times);

    return factors;
  }

  private analyzeRootCause(pattern: FailurePattern, commonFactors: any): any {
    const evidence = [];
    let identifiedCause = 'Unknown';
    let confidence = 0.3;

    // Analyze error signature
    if (pattern.errorSignature.includes('timeout')) {
      identifiedCause = 'Performance/timeout issue';
      confidence = 0.8;
      evidence.push('Error signature contains timeout indication');
    } else if (pattern.errorSignature.includes('validation')) {
      identifiedCause = 'Input validation failure';
      confidence = 0.85;
      evidence.push('Error signature indicates validation failure');
    } else if (pattern.errorSignature.includes('rate limit')) {
      identifiedCause = 'API rate limiting';
      confidence = 0.9;
      evidence.push('Error signature shows rate limit exceeded');
    }

    // Analyze common factors
    if (commonFactors.inputPatterns.length > 0) {
      evidence.push(`Common input patterns: ${commonFactors.inputPatterns.join(', ')}`);
      confidence = Math.min(confidence + 0.1, 0.95);
    }

    if (commonFactors.environmentFactors.includes('peak_hours')) {
      evidence.push('Failures occur during peak usage hours');
      if (identifiedCause === 'Unknown') {
        identifiedCause = 'Resource contention during peak hours';
        confidence = 0.7;
      }
    }

    const suggestedFixes = this.generateSuggestedFixes(identifiedCause, pattern);

    return {
      identifiedCause,
      confidence,
      evidence,
      suggestedFixes,
    };
  }

  private generateSuggestedFixes(cause: string, pattern: FailurePattern): string[] {
    const fixes = [];

    switch (cause) {
      case 'Performance/timeout issue':
        fixes.push('Increase timeout thresholds');
        fixes.push('Optimize processing logic');
        fixes.push('Implement request batching');
        fixes.push('Add caching layer');
        break;

      case 'Input validation failure':
        fixes.push('Review and update input validation rules');
        fixes.push('Add input sanitization');
        fixes.push('Improve error messages for validation failures');
        fixes.push('Update test cases with edge cases');
        break;

      case 'API rate limiting':
        fixes.push('Implement exponential backoff');
        fixes.push('Add request queuing');
        fixes.push('Optimize API usage patterns');
        fixes.push('Consider upgrading API limits');
        break;

      case 'Resource contention during peak hours':
        fixes.push('Implement load balancing');
        fixes.push('Add horizontal scaling');
        fixes.push('Optimize resource usage');
        fixes.push('Schedule non-critical tasks during off-peak hours');
        break;

      default:
        fixes.push('Add comprehensive logging');
        fixes.push('Implement better error handling');
        fixes.push('Add monitoring and alerting');
        fixes.push('Review and update test coverage');
    }

    return fixes;
  }

  private async findSimilarFailures(pattern: FailurePattern): Promise<EvaluationResult[]> {
    const query = this.evaluationResultRepo
      .createQueryBuilder('result')
      .where('result.success = false')
      .andWhere('result.patternType = :patternType', {
        patternType: pattern.patternType,
      })
      .andWhere('result.createdAt > :date', {
        date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      })
      .orderBy('result.createdAt', 'DESC')
      .limit(20);

    if (pattern.category === 'validation') {
      query.andWhere('result.error LIKE :pattern', {
        pattern: '%validation%',
      });
    }

    return query.getMany();
  }

  private async generateRootCauseHypotheses(pattern: FailurePattern): Promise<any[]> {
    const hypotheses = [];

    if (pattern.rootCauseAnalysis) {
      hypotheses.push({
        cause: pattern.rootCauseAnalysis.identifiedCause,
        confidence: pattern.rootCauseAnalysis.confidence,
        evidence: pattern.rootCauseAnalysis.evidence,
      });
    }

    // Additional hypothesis based on occurrence patterns
    if (pattern.occurrenceCount > 50) {
      hypotheses.push({
        cause: 'Systemic issue requiring architectural change',
        confidence: 0.6,
        evidence: [`High occurrence count: ${pattern.occurrenceCount}`],
      });
    }

    // Temporal pattern hypothesis
    const timeAnalysis = this.analyzeFailureTiming(pattern);
    if (timeAnalysis.pattern) {
      hypotheses.push({
        cause: `Time-based issue: ${timeAnalysis.pattern}`,
        confidence: timeAnalysis.confidence,
        evidence: timeAnalysis.evidence,
      });
    }

    return hypotheses.sort((a, b) => b.confidence - a.confidence);
  }

  private generateRemediations(pattern: FailurePattern, hypotheses: any[]): any[] {
    const remediations = [];

    for (const hypothesis of hypotheses) {
      const fixes = this.generateSuggestedFixes(hypothesis.cause, pattern);

      fixes.forEach((fix, index) => {
        remediations.push({
          action: fix,
          priority: this.calculatePriority(pattern, hypothesis.confidence),
          estimatedEffort: this.estimateEffort(fix),
        });
      });
    }

    return remediations;
  }

  private async updateFailureStatuses(): Promise<void> {
    const patterns = await this.failurePatternRepo.find({
      where: { status: In(['active', 'monitoring']) },
    });

    for (const pattern of patterns) {
      const recentOccurrences = await this.evaluationResultRepo.count({
        where: {
          patternType: pattern.patternType,
          success: false,
          createdAt: MoreThan(new Date(Date.now() - 24 * 60 * 60 * 1000)),
        },
      });

      if (pattern.status === 'monitoring' && recentOccurrences === 0) {
        pattern.status = 'resolved';
        pattern.resolvedAt = new Date();
      } else if (pattern.status === 'active' && recentOccurrences < 5) {
        pattern.status = 'monitoring';
      }

      await this.failurePatternRepo.save(pattern);
    }
  }

  private categorizeError(error: string): string {
    if (!error) return 'unknown';

    const categories = {
      timeout: ['timeout', 'timed out', 'deadline exceeded'],
      validation: ['validation', 'invalid', 'required', 'must be'],
      rateLimit: ['rate limit', 'too many requests', '429'],
      network: ['network', 'connection', 'refused', 'unreachable'],
      parsing: ['parsing', 'syntax', 'unexpected token', 'json'],
      authentication: ['auth', 'unauthorized', '401', 'forbidden', '403'],
      resource: ['not found', '404', 'missing', 'does not exist'],
      server: ['500', 'internal server', 'server error'],
    };

    const errorLower = error.toLowerCase();

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some((keyword) => errorLower.includes(keyword))) {
        return category;
      }
    }

    return 'other';
  }

  private getSubCategory(error: string): string {
    if (!error) return null;

    const errorLower = error.toLowerCase();

    if (errorLower.includes('prompt')) return 'prompt_issue';
    if (errorLower.includes('model')) return 'model_issue';
    if (errorLower.includes('memory')) return 'memory_issue';
    if (errorLower.includes('token')) return 'token_issue';

    return null;
  }

  private generateErrorSignature(result: EvaluationResult): string {
    const error = result.error || 'no_error';
    const pattern = result.patternType;
    const category = this.categorizeError(error);

    // Create a normalized signature
    const normalizedError = error
      .replace(/\d+/g, 'N')
      .replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, 'UUID')
      .substring(0, 100);

    return `${pattern}:${category}:${normalizedError}`;
  }

  private generateDescription(result: EvaluationResult): string {
    const category = this.categorizeError(result.error);
    const pattern = result.patternType;

    return `${category} error in ${pattern} pattern: ${result.error?.substring(0, 200) || 'Unknown error'}`;
  }

  private calculateImpactScore(pattern: FailurePattern): number {
    const factors = {
      occurrenceCount: Math.min(pattern.occurrenceCount / 100, 1) * 0.3,
      recency: this.calculateRecencyScore(pattern.lastSeen) * 0.2,
      frequency: this.calculateFrequencyScore(pattern) * 0.3,
      severity: this.calculateSeverityScore(pattern) * 0.2,
    };

    return Object.values(factors).reduce((sum, score) => sum + score, 0);
  }

  private calculateRecencyScore(lastSeen: Date): number {
    const hoursSince = (Date.now() - lastSeen.getTime()) / (1000 * 60 * 60);
    if (hoursSince < 1) return 1;
    if (hoursSince < 24) return 0.8;
    if (hoursSince < 168) return 0.5;
    return 0.2;
  }

  private calculateFrequencyScore(pattern: FailurePattern): number {
    const daysSinceFirst = (Date.now() - pattern.firstSeen.getTime()) / (1000 * 60 * 60 * 24);
    const dailyRate = pattern.occurrenceCount / Math.max(daysSinceFirst, 1);

    if (dailyRate > 10) return 1;
    if (dailyRate > 5) return 0.8;
    if (dailyRate > 1) return 0.5;
    return 0.2;
  }

  private calculateSeverityScore(pattern: FailurePattern): number {
    const severityKeywords = {
      critical: ['crash', 'fatal', 'critical', 'emergency'],
      high: ['error', 'fail', 'exception', 'timeout'],
      medium: ['warning', 'retry', 'slow'],
      low: ['info', 'notice'],
    };

    const description = pattern.description.toLowerCase();

    if (severityKeywords.critical.some((k) => description.includes(k))) return 1;
    if (severityKeywords.high.some((k) => description.includes(k))) return 0.7;
    if (severityKeywords.medium.some((k) => description.includes(k))) return 0.4;
    return 0.2;
  }

  private findCommonPatterns(inputs: any[]): string[] {
    const patterns = [];

    if (inputs.length < 3) return patterns;

    // Find common keys
    const allKeys = inputs.flatMap((input) => Object.keys(input));
    const keyFrequency = {};
    allKeys.forEach((key) => {
      keyFrequency[key] = (keyFrequency[key] || 0) + 1;
    });

    const commonKeys = Object.entries(keyFrequency)
      .filter(([_, count]) => count >= inputs.length * 0.8)
      .map(([key]) => key);

    if (commonKeys.length > 0) {
      patterns.push(`Common keys: ${commonKeys.join(', ')}`);
    }

    // Find common value patterns
    for (const key of commonKeys) {
      const values = inputs.map((input) => input[key]).filter(Boolean);
      if (values.length > 0) {
        const uniqueValues = [...new Set(values)];
        if (uniqueValues.length === 1) {
          patterns.push(`${key} always equals "${uniqueValues[0]}"`);
        } else if (uniqueValues.length < values.length * 0.3) {
          patterns.push(`${key} has limited values: ${uniqueValues.slice(0, 3).join(', ')}`);
        }
      }
    }

    return patterns;
  }

  private findCommonProperties(configs: any[]): any {
    const commonProps = {};

    if (configs.length === 0) return commonProps;

    const firstConfig = configs[0];
    for (const key in firstConfig) {
      const values = configs.map((c) => c[key]);
      const uniqueValues = [...new Set(values.map((v) => JSON.stringify(v)))];

      if (uniqueValues.length === 1) {
        commonProps[key] = JSON.parse(uniqueValues[0]);
      }
    }

    return commonProps;
  }

  private analyzeTemporalPatterns(times: Date[]): string[] {
    const patterns = [];

    if (times.length < 5) return patterns;

    // Check for time-of-day patterns
    const hours = times.map((t) => t.getHours());
    const hourCounts = {};
    hours.forEach((h) => {
      hourCounts[h] = (hourCounts[h] || 0) + 1;
    });

    const peakHours = Object.entries(hourCounts)
      .filter(([_, count]) => count > times.length * 0.3)
      .map(([hour]) => parseInt(hour));

    if (peakHours.length > 0) {
      patterns.push(`peak_hours: ${peakHours.join(', ')}`);
    }

    // Check for day-of-week patterns
    const days = times.map((t) => t.getDay());
    const weekendCount = days.filter((d) => d === 0 || d === 6).length;
    if (weekendCount > times.length * 0.5) {
      patterns.push('weekend_concentration');
    }

    return patterns;
  }

  private analyzeFailureTiming(pattern: FailurePattern): any {
    if (pattern.exampleCases.length < 5) {
      return { pattern: null, confidence: 0, evidence: [] };
    }

    const times = pattern.exampleCases.map((c) => new Date(c.timestamp));
    const intervals = [];

    for (let i = 1; i < times.length; i++) {
      intervals.push(times[i].getTime() - times[i - 1].getTime());
    }

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const evidence = [];

    if (avgInterval < 60000) {
      return {
        pattern: 'Burst failures (multiple failures within minutes)',
        confidence: 0.8,
        evidence: ['Average interval between failures < 1 minute'],
      };
    }

    const hours = times.map((t) => t.getHours());
    const businessHours = hours.filter((h) => h >= 9 && h <= 17).length;

    if (businessHours > hours.length * 0.8) {
      return {
        pattern: 'Business hours concentration',
        confidence: 0.7,
        evidence: ['80% of failures occur during business hours'],
      };
    }

    return { pattern: null, confidence: 0, evidence: [] };
  }

  private calculatePriority(
    pattern: FailurePattern,
    confidence: number,
  ): 'high' | 'medium' | 'low' {
    const score = pattern.impactScore * confidence;
    if (score > 0.7) return 'high';
    if (score > 0.4) return 'medium';
    return 'low';
  }

  private estimateEffort(action: string): 'low' | 'medium' | 'high' {
    const lowEffortKeywords = ['increase', 'add', 'update', 'review'];
    const highEffortKeywords = ['implement', 'refactor', 'redesign', 'migrate'];

    const actionLower = action.toLowerCase();

    if (highEffortKeywords.some((k) => actionLower.includes(k))) return 'high';
    if (lowEffortKeywords.some((k) => actionLower.includes(k))) return 'low';
    return 'medium';
  }
}
