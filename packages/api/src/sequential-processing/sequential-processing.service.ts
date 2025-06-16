import { Injectable } from '@nestjs/common';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText, generateObject, streamObject } from 'ai';
import { z } from 'zod';

const google = createGoogleGenerativeAI();

@Injectable()
export class SequentialProcessingService {
  async generateMarketingCopy(input: string) {
    const model = google('models/gemini-2.5-flash-preview-05-20');

    const { text: copy } = await generateText({
      model,
      prompt: `Write persuasive marketing copy for: ${input}. Focus on benefits and emotional appeal.`,
    });

    const { object: qualityMetrics } = await generateObject({
      model,
      schema: z.object({
        hasCallToAction: z.boolean(),
        emotionalAppeal: z.number().min(1).max(10),
        clarity: z.number().min(1).max(10),
      }),
      prompt: `Evaluate this marketing copy for:\n1. Presence of call to action (true/false)\n2. Emotional appeal (1-10)\n3. Clarity (1-10)\n\nCopy to evaluate: ${copy}`,
    });

    let finalCopy = copy;
    if (
      !qualityMetrics.hasCallToAction ||
      qualityMetrics.emotionalAppeal < 7 ||
      qualityMetrics.clarity < 7
    ) {
      const { text: improvedCopy } = await generateText({
        model,
        prompt: `Rewrite this marketing copy with:\n${!qualityMetrics.hasCallToAction ? '- A clear call to action' : ''}\n${qualityMetrics.emotionalAppeal < 7 ? '- Stronger emotional appeal' : ''}\n${qualityMetrics.clarity < 7 ? '- Improved clarity and directness' : ''}\n\nOriginal copy: ${copy}`,
      });
      finalCopy = improvedCopy;
    }

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

    return result;
  }
}
