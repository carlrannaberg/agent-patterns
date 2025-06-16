import { Controller, Post, Body, Res } from '@nestjs/common';
import { Response } from 'express';
import { EvaluatorOptimizerService } from './evaluator-optimizer.service';

@Controller('evaluator-optimizer')
export class EvaluatorOptimizerController {
  constructor(
    private readonly evaluatorOptimizerService: EvaluatorOptimizerService,
  ) {}

  @Post()
  async translateWithFeedback(
    @Body() body: { text: string; targetLanguage: string },
    @Res() res: Response,
  ) {
    const result = await this.evaluatorOptimizerService.translateWithFeedback(
      body.text,
      body.targetLanguage,
    );

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // For streamObject, use pipeTextStreamToResponse
    result.pipeTextStreamToResponse(res);
  }
}
