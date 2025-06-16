import { Controller, Post, Body, Res } from '@nestjs/common';
import { Response } from 'express';
import { MultiStepToolUsageService } from './multi-step-tool-usage.service';

@Controller('multi-step-tool-usage')
export class MultiStepToolUsageController {
  constructor(private readonly multiStepToolUsageService: MultiStepToolUsageService) {}

  @Post()
  async solveMathProblem(@Body() body: { input: string }, @Res() res: Response) {
    const result = await this.multiStepToolUsageService.solveMathProblem(body.input);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // For streamObject, use pipeTextStreamToResponse
    result.pipeTextStreamToResponse(res);
  }
}
