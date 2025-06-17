import { Controller, Post, Body, Res } from '@nestjs/common';
import { Response } from 'express';
import { RoutingService } from './routing.service';

@Controller('routing')
export class RoutingController {
  constructor(private readonly routingService: RoutingService) {}

  @Post()
  async handleCustomerQuery(@Body() body: { input: string }, @Res() res: Response) {
    const result = await this.routingService.handleCustomerQuery(body.input);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // For streamObject, use pipeTextStreamToResponse
    result.pipeTextStreamToResponse(res);
  }
}
