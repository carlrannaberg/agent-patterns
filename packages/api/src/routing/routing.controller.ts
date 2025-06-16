import { Controller, Post, Body, Res } from '@nestjs/common';
import { Response } from 'express';
import { RoutingService } from './routing.service';

@Controller('routing')
export class RoutingController {
  constructor(private readonly routingService: RoutingService) {}

  @Post()
  async handleCustomerQuery(
    @Body() body: { query: string },
    @Res() res: Response,
  ) {
    const stream = await this.routingService.handleCustomerQuery(body.query);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    (stream as unknown as NodeJS.ReadableStream).pipe(res);
  }
}
