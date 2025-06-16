import { Controller, Post, Body, Res } from '@nestjs/common';
import { Response } from 'express';
import { SequentialProcessingService } from './sequential-processing.service';

@Controller('sequential-processing')
export class SequentialProcessingController {
  constructor(
    private readonly sequentialProcessingService: SequentialProcessingService,
  ) {}

  @Post()
  async generateMarketingCopy(
    @Body() body: { input: string },
    @Res() res: Response,
  ) {
    const result = await this.sequentialProcessingService.generateMarketingCopy(
      body.input,
    );

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // For streamObject, use pipeTextStreamToResponse
    result.pipeTextStreamToResponse(res);
  }
}
