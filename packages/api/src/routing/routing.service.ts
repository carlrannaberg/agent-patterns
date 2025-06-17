import { Injectable, Logger } from '@nestjs/common';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateObject, generateText, streamObject } from 'ai';
import { z } from 'zod';

const google = createGoogleGenerativeAI();

@Injectable()
export class RoutingService {
  private readonly logger = new Logger(RoutingService.name);

  async handleCustomerQuery(query: string) {
    if (!query) {
      throw new Error('Query is required');
    }

    this.logger.verbose(`Starting routing for query: "${query.substring(0, 50)}..."`);
    const model = google('models/gemini-2.5-pro-preview-06-05');

    this.logger.verbose('Step 1: Classifying customer query');
    const { object: classification } = await generateObject({
      model,
      schema: z.object({
        reasoning: z.string(),
        type: z.enum(['general', 'refund', 'technical']),
        complexity: z.enum(['simple', 'complex']),
      }),
      prompt: `Classify this customer query:\n${query}\n\nDetermine:\n1. Query type (general, refund, or technical)\n2. Complexity (simple or complex)\n3. Brief reasoning for classification`,
    });
    this.logger.verbose(`Step 1 completed. Classification: ${JSON.stringify(classification)}`);

    this.logger.verbose(
      `Step 2: Selecting model based on complexity (${classification.complexity})`,
    );
    const responseModel =
      classification.complexity === 'simple'
        ? google('models/gemini-2.5-flash-preview-05-20')
        : google('models/gemini-2.5-pro-preview-06-05');
    this.logger.verbose(`Step 2 completed. Selected model: ${responseModel.modelId}`);

    const systemPrompts = {
      general: 'You are an expert customer service agent handling general inquiries.',
      refund:
        'You are a customer service agent specializing in refund requests. Follow company policy and collect necessary information.',
      technical:
        'You are a technical support specialist with deep product knowledge. Focus on clear step-by-step troubleshooting.',
    };

    this.logger.verbose(`Step 3: Generating specialized response for ${classification.type} query`);
    const { text: response } = await generateText({
      model: responseModel,
      system: systemPrompts[classification.type],
      messages: [{ role: 'user', content: query }],
    });
    this.logger.verbose(`Step 3 completed. Response length: ${response.length} characters`);

    this.logger.verbose('Step 4: Streaming final result');
    const result = streamObject({
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
    });

    this.logger.verbose('Routing completed, returning stream');
    return result;
  }
}
