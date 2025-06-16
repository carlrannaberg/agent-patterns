import { Injectable, Logger } from '@nestjs/common';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText, generateObject, streamObject } from 'ai';
import { z } from 'zod';

const google = createGoogleGenerativeAI();

@Injectable()
export class SequentialProcessingService {
  private readonly logger = new Logger(SequentialProcessingService.name);

  async generateMarketingCopy(input: string) {
    this.logger.verbose(
      `Starting sequential processing for input: "${input.substring(0, 50)}..."`,
    );
    const model = google('models/gemini-2.5-flash-preview-05-20');

    this.logger.verbose('Step 1: Generating initial marketing copy');
    const { text: copy } = await generateText({
      model,
      prompt: `Write persuasive marketing copy for: ${input}. Focus on benefits and emotional appeal.`,
    });
    this.logger.verbose(
      `Step 1 completed. Generated copy length: ${copy.length} characters`,
    );

    this.logger.verbose('Step 2: Evaluating copy quality metrics');
    const { object: qualityMetrics } = await generateObject({
      model,
      schema: z.object({
        hasCallToAction: z.boolean(),
        emotionalAppeal: z.number().min(1).max(10),
        clarity: z.number().min(1).max(10),
      }),
      prompt: `Evaluate this marketing copy for:\n1. Presence of call to action (true/false)\n2. Emotional appeal (1-10)\n3. Clarity (1-10)\n\nCopy to evaluate: ${copy}`,
    });
    this.logger.verbose(
      `Step 2 completed. Quality metrics: ${JSON.stringify(qualityMetrics)}`,
    );

    let finalCopy = copy;
    if (
      !qualityMetrics.hasCallToAction ||
      qualityMetrics.emotionalAppeal < 7 ||
      qualityMetrics.clarity < 7
    ) {
      this.logger.verbose(
        'Step 3: Copy needs improvement, generating improved version',
      );
      const { text: improvedCopy } = await generateText({
        model,
        prompt: `Rewrite this marketing copy with:\n${!qualityMetrics.hasCallToAction ? '- A clear call to action' : ''}\n${qualityMetrics.emotionalAppeal < 7 ? '- Stronger emotional appeal' : ''}\n${qualityMetrics.clarity < 7 ? '- Improved clarity and directness' : ''}\n\nOriginal copy: ${copy}`,
      });
      finalCopy = improvedCopy;
      this.logger.verbose(
        `Step 3 completed. Improved copy length: ${improvedCopy.length} characters`,
      );
    } else {
      this.logger.verbose(
        'Step 3: Copy quality is sufficient, no improvement needed',
      );
    }

    this.logger.verbose('Step 4: Streaming final result');
    const result = streamObject({
      model,
      schema: z.object({
        originalCopy: z.string(),
        finalCopy: z.string(),
        qualityMetrics: z.object({
          hasCallToAction: z.boolean(),
          emotionalAppeal: z.number(),
          clarity: z.number(),
        }),
        wasImproved: z.boolean(),
      }),
      prompt: `Return the following data as a structured object:\n\nOriginal copy: ${copy}\nFinal copy: ${finalCopy}\nQuality metrics: ${JSON.stringify(qualityMetrics)}\nWas improved: ${finalCopy !== copy}`,
    });

    this.logger.verbose('Sequential processing completed, returning stream');
    return result;
  }
}
