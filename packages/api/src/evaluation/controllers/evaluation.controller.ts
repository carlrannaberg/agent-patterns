import { Controller, Post, Body, Logger } from '@nestjs/common';
import { EvaluationService } from '../services/evaluation.service';

@Controller('evaluation')
export class EvaluationController {
  private readonly logger = new Logger(EvaluationController.name);

  constructor(private readonly evaluationService: EvaluationService) {}

  @Post('evaluate-single')
  evaluateSingle(@Body() body: { patternType: string; input: any; output: any; config?: any }) {
    this.logger.log(`Starting single evaluation for pattern: ${body.patternType}`);

    try {
      // Return a mock response for now
      const result = {
        id: `eval-${Date.now()}`,
        patternType: body.patternType,
        overallScore: Math.random() * 100,
        pass: Math.random() > 0.5,
        executionTimeMs: Math.floor(Math.random() * 1000),
        success: true,
        metricScores: [
          {
            metricName: 'quality',
            score: Math.random() * 100,
            weight: 1.0,
            feedback: 'Mock evaluation feedback',
          },
        ],
        details: {
          evaluationMethod: 'mock-evaluation',
          timestamp: new Date().toISOString(),
        },
      };

      this.logger.log(
        `Evaluation completed for ${body.patternType}: score ${result.overallScore.toFixed(2)}`,
      );
      return result;
    } catch (error) {
      this.logger.error(`Evaluation failed for ${body.patternType}:`, error);
      throw error;
    }
  }

  @Post('evaluate-pattern')
  evaluatePattern(@Body() body: { patternType: string; testCaseLimit?: number; config?: any }) {
    this.logger.log(`Starting pattern evaluation for: ${body.patternType}`);

    const result = {
      batchId: `batch-${Date.now()}`,
      pattern: body.patternType,
      summary: {
        totalTestCases: body.testCaseLimit || 5,
        passedTestCases: Math.floor(Math.random() * (body.testCaseLimit || 5)),
        averageScore: Math.random() * 100,
      },
      success: true,
      message: 'Mock pattern evaluation completed',
    };

    this.logger.log(
      `Pattern evaluation completed for ${body.patternType}: ${result.summary.passedTestCases}/${result.summary.totalTestCases} passed`,
    );
    return result;
  }
}
