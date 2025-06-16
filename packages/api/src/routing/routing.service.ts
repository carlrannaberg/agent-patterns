import { Injectable } from '@nestjs/common';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateObject, generateText, streamObject } from 'ai';
import { z } from 'zod';

const google = createGoogleGenerativeAI();

@Injectable()
export class RoutingService {
  async handleCustomerQuery(query: string) {
    const model = google('models/gemini-2.5-pro-preview-06-05');

    const { object: classification } = await generateObject({
      model,
      schema: z.object({
        reasoning: z.string(),
        type: z.enum(['general', 'refund', 'technical']),
        complexity: z.enum(['simple', 'complex']),
      }),
      prompt: `Classify this customer query:\n${query}\n\nDetermine:\n1. Query type (general, refund, or technical)\n2. Complexity (simple or complex)\n3. Brief reasoning for classification`,
    });

    const responseModel =
      classification.complexity === 'simple'
        ? google('models/gemini-2.5-flash-preview-05-20')
        : google('models/gemini-2.5-pro-preview-06-05');

    const systemPrompts = {
      general:
        'You are an expert customer service agent handling general inquiries.',
      refund:
        'You are a customer service agent specializing in refund requests. Follow company policy and collect necessary information.',
      technical:
        'You are a technical support specialist with deep product knowledge. Focus on clear step-by-step troubleshooting.',
    };

    const { text: response } = await generateText({
      model: responseModel,
      system: systemPrompts[classification.type],
      prompt: query,
    });

    return streamObject({
      model,
      schema: z.object({
        response: z.string(),
        classification: z.object({
          reasoning: z.string(),
          type: z.enum(['general', 'refund', 'technical']),
          complexity: z.enum(['simple', 'complex']),
        }),
        modelUsed: z.string(),
      }),
      prompt: `Return the following data as a structured object:\n\nResponse: ${response}\nClassification: ${JSON.stringify(classification)}\nModel used: ${responseModel.modelId}`,
    }).toTextStreamResponse();
  }
}
