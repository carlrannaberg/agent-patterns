import { Controller, Post, Body, Res } from '@nestjs/common';
import { Response } from 'express';
import { ParallelProcessingService } from './parallel-processing.service';

@Controller('parallel-processing')
export class ParallelProcessingController {
  constructor(
    private readonly parallelProcessingService: ParallelProcessingService,
  ) {}

  @Post()
  async reviewCode(@Body() body: { input: string }, @Res() res: Response) {
    const result = await this.parallelProcessingService.parallelCodeReview(
      body.input,
    );

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // For streamObject, use pipeTextStreamToResponse
    result.pipeTextStreamToResponse(res);
  }
}
