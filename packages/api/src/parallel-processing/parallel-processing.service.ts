import { Injectable, Logger } from '@nestjs/common';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText, generateObject, streamObject } from 'ai';
import { z } from 'zod';

const google = createGoogleGenerativeAI();

@Injectable()
export class ParallelProcessingService {
  private readonly logger = new Logger(ParallelProcessingService.name);
  async parallelCodeReview(code: string) {
    this.logger.log('Starting parallel code review process');
    this.logger.debug(`Code length: ${code.length} characters`);

    const model = google('models/gemini-2.5-pro-preview-06-05');

    this.logger.log(
      'Initiating parallel reviews: security, performance, and maintainability',
    );

    const [securityReview, performanceReview, maintainabilityReview] =
      await Promise.all([
        generateObject({
          model,
          system:
            'You are an expert in code security. Focus on identifying vulnerabilities, security flaws, and potential attack vectors.',
          schema: z.object({
            vulnerabilities: z.array(z.string()),
            riskLevel: z.enum(['low', 'medium', 'high']),
            suggestions: z.array(z.string()),
          }),
          prompt: `Review this code for security issues:\n${code}`,
        }),
        generateObject({
          model,
          system:
            'You are an expert in code performance. Focus on identifying performance bottlenecks, inefficiencies, and optimization opportunities.',
          schema: z.object({
            issues: z.array(z.string()),
            impact: z.enum(['low', 'medium', 'high']),
            optimizations: z.array(z.string()),
          }),
          prompt: `Review this code for performance issues:\n${code}`,
        }),
        generateObject({
          model,
          system:
            'You are an expert in code quality and maintainability. Focus on code structure, readability, and maintainability concerns.',
          schema: z.object({
            concerns: z.array(z.string()),
            qualityScore: z.number().min(1).max(10),
            recommendations: z.array(z.string()),
          }),
          prompt: `Review this code for maintainability and quality:\n${code}`,
        }),
      ]);

    this.logger.log('Parallel reviews completed successfully');
    this.logger.debug(
      `Security risk level: ${securityReview.object.riskLevel}`,
    );
    this.logger.debug(`Performance impact: ${performanceReview.object.impact}`);
    this.logger.debug(
      `Maintainability quality score: ${maintainabilityReview.object.qualityScore}`,
    );

    const reviews = [
      { ...securityReview.object, type: 'security' },
      { ...performanceReview.object, type: 'performance' },
      { ...maintainabilityReview.object, type: 'maintainability' },
    ];

    this.logger.log('Generating comprehensive summary from all reviews');

    const { text: summary } = await generateText({
      model,
      system: 'You are a technical lead summarizing multiple code reviews.',
      prompt: `Synthesize these code review results into a concise summary with key actions:\n${JSON.stringify(reviews, null, 2)}`,
    });

    this.logger.log('Summary generation completed');
    this.logger.debug(`Summary length: ${summary.length} characters`);
    this.logger.log('Starting final streaming result generation');

    const result = streamObject({
      model,
      schema: z.object({
        reviews: z.array(
          z.object({
            type: z.enum(['security', 'performance', 'maintainability']),
            vulnerabilities: z.array(z.string()).optional(),
            riskLevel: z.enum(['low', 'medium', 'high']).optional(),
            suggestions: z.array(z.string()).optional(),
            issues: z.array(z.string()).optional(),
            impact: z.enum(['low', 'medium', 'high']).optional(),
            optimizations: z.array(z.string()).optional(),
            concerns: z.array(z.string()).optional(),
            qualityScore: z.number().optional(),
            recommendations: z.array(z.string()).optional(),
          }),
        ),
        summary: z.string(),
      }),
      prompt: `Return the following data as a structured object:\n\nReviews: ${JSON.stringify(reviews)}\nSummary: ${summary}`,
    });

    this.logger.log(
      'Parallel code review process completed - streaming results',
    );
    return result;
  }
}
