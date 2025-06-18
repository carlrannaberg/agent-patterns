import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AgentPattern } from '../enums/agent-pattern.enum';
import { GoldDatasetService } from '../services/gold-dataset.service';
import { HumanScoringService } from '../services/human-scoring.service';
import { HumanScore, GoldSample } from '../interfaces/gold-dataset.interface';

@ApiTags('human-scoring')
@Controller('evaluation/human-scoring')
export class HumanScoringController {
  constructor(
    private readonly goldDatasetService: GoldDatasetService,
    private readonly humanScoringService: HumanScoringService,
  ) {}

  @Get('patterns/:pattern/samples')
  @ApiOperation({ summary: 'Get samples for human evaluation' })
  @ApiResponse({ status: 200, description: 'Returns samples for evaluation' })
  async getSamplesForEvaluation(
    @Param('pattern') pattern: AgentPattern,
    @Query('evaluatorId') evaluatorId: string,
    @Query('limit') limit?: number,
  ): Promise<GoldSample[]> {
    return this.humanScoringService.getUnscoreSamples(pattern, evaluatorId, limit || 10);
  }

  @Post('patterns/:pattern/samples/:sampleId/score')
  @ApiOperation({ summary: 'Submit human score for a sample' })
  @ApiResponse({ status: 201, description: 'Score submitted successfully' })
  async submitScore(
    @Param('pattern') pattern: AgentPattern,
    @Param('sampleId') sampleId: string,
    @Body()
    scoreData: {
      evaluatorId: string;
      scores: {
        overall: number;
        [dimension: string]: number;
      };
      comments?: string;
      timeSpent: number;
    },
  ): Promise<GoldSample> {
    const humanScore: HumanScore = {
      evaluatorId: scoreData.evaluatorId,
      timestamp: new Date(),
      scores: scoreData.scores,
      comments: scoreData.comments,
      timeSpent: scoreData.timeSpent,
    };

    return this.goldDatasetService.addHumanScore(pattern, sampleId, humanScore);
  }

  @Get('evaluators/:evaluatorId/progress')
  @ApiOperation({ summary: 'Get evaluator progress' })
  @ApiResponse({ status: 200, description: 'Returns evaluator progress' })
  async getEvaluatorProgress(@Param('evaluatorId') evaluatorId: string): Promise<{
    totalScored: number;
    byPattern: Record<AgentPattern, number>;
    averageTimePerSample: number;
    lastActivity: Date | null;
  }> {
    return this.humanScoringService.getEvaluatorProgress(evaluatorId);
  }

  @Get('patterns/:pattern/agreement')
  @ApiOperation({ summary: 'Get inter-rater agreement statistics' })
  @ApiResponse({ status: 200, description: 'Returns agreement statistics' })
  async getAgreementStatistics(@Param('pattern') pattern: AgentPattern): Promise<{
    krippendorffAlpha: number;
    pairwiseAgreements: Record<string, number>;
    sampleCount: number;
  }> {
    return this.humanScoringService.calculateAgreementStatistics(pattern);
  }

  @Get('patterns/:pattern/scoring-rubric')
  @ApiOperation({ summary: 'Get scoring rubric for a pattern' })
  @ApiResponse({ status: 200, description: 'Returns scoring rubric' })
  async getScoringRubric(@Param('pattern') pattern: AgentPattern): Promise<{
    dimensions: Array<{
      name: string;
      description: string;
      weight: number;
      scale: Array<{
        score: number;
        description: string;
      }>;
    }>;
  }> {
    return this.humanScoringService.getScoringRubric(pattern);
  }
}
