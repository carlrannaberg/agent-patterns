import { Controller, Post, Body, Res } from '@nestjs/common';
import { Response } from 'express';
import { OrchestratorWorkerService } from './orchestrator-worker.service';

@Controller('orchestrator-worker')
export class OrchestratorWorkerController {
  constructor(private readonly orchestratorWorkerService: OrchestratorWorkerService) {}

  @Post()
  async implementFeature(@Body() body: { input: string }, @Res() res: Response) {
    const result = await this.orchestratorWorkerService.implementFeature(body.input);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    result.pipeTextStreamToResponse(res);
  }
}
