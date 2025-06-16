import { Controller, Post, Body, Res } from '@nestjs/common';
import { Response } from 'express';
import { EvaluatorOptimizerService } from './evaluator-optimizer.service';

@Controller('evaluator-optimizer')
export class EvaluatorOptimizerController {
  constructor(private readonly evaluatorOptimizerService: EvaluatorOptimizerService) {}

  @Post()
  async translateWithFeedback(@Body() body: { input: string }, @Res() res: Response) {
    // Parse input to extract text and target language
    // Expected format: "text to translate [target: language]" or just "text to translate" (defaults to Estonian)
    const input = body.input;
    const targetLanguageMatch = input.match(/\[target:\s*([^\]]+)\]/i);

    let text: string;
    let targetLanguage: string;

    if (targetLanguageMatch) {
      text = input.replace(/\[target:\s*[^\]]+\]/i, '').trim();
      targetLanguage = targetLanguageMatch[1].trim();
    } else {
      text = input;
      targetLanguage = 'Estonian';
    }

    const result = await this.evaluatorOptimizerService.translateWithFeedback(text, targetLanguage);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // For streamObject, use pipeTextStreamToResponse
    result.pipeTextStreamToResponse(res);
  }
}
