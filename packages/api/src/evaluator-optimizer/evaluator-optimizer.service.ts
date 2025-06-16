import { Injectable } from '@nestjs/common';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText, generateObject, streamObject } from 'ai';
import { z } from 'zod';

const google = createGoogleGenerativeAI();

@Injectable()
export class EvaluatorOptimizerService {
  async translateWithFeedback(text: string, targetLanguage: string) {
    let currentTranslation = '';
    let iterations = 0;
    const MAX_ITERATIONS = 3;
    const iterationResults: Array<{
      translation: string;
      evaluation: any;
      iteration: number;
    }> = [];

    const translatorModel = google('models/gemini-1.5-flash-latest');
    const evaluatorModel = google('models/gemini-1.5-pro-latest');

    const { text: translation } = await generateText({
      model: translatorModel,
      system:
        'You are an expert literary translator. Focus on preserving tone, nuance, and cultural context.',
      prompt: `Translate this text to ${targetLanguage}, maintaining the original style and meaning:\n\n${text}`,
    });
    currentTranslation = translation;

    while (iterations < MAX_ITERATIONS) {
      const { object: evaluation } = await generateObject({
        model: evaluatorModel,
        schema: z.object({
          qualityScore: z.number().min(1).max(10),
          preservesTone: z.boolean(),
          preservesNuance: z.boolean(),
          culturallyAccurate: z.boolean(),
          specificIssues: z.array(z.string()),
          improvementSuggestions: z.array(z.string()),
        }),
        system:
          'You are an expert in evaluating literary translations. Be thorough and critical.',
        prompt: `Evaluate this translation from the original to ${targetLanguage}:\n\nOriginal: ${text}\nTranslation: ${currentTranslation}\n\nAssess quality, tone preservation, nuance, and cultural accuracy.`,
      });

      iterationResults.push({
        translation: currentTranslation,
        evaluation,
        iteration: iterations,
      });

      if (
        evaluation.qualityScore >= 8 &&
        evaluation.preservesTone &&
        evaluation.preservesNuance &&
        evaluation.culturallyAccurate
      ) {
        break;
      }

      if (iterations < MAX_ITERATIONS - 1) {
        const { text: improvedTranslation } = await generateText({
          model: google('models/gemini-1.5-pro-latest'),
          system:
            'You are an expert literary translator. Focus on addressing the specific feedback provided.',
          prompt: `Improve this translation based on the following feedback:\n\nSpecific Issues:\n${evaluation.specificIssues.join('\n')}\n\nImprovement Suggestions:\n${evaluation.improvementSuggestions.join('\n')}\n\nOriginal Text: ${text}\nCurrent Translation: ${currentTranslation}\n\nProvide an improved translation to ${targetLanguage}.`,
        });
        currentTranslation = improvedTranslation;
      }

      iterations++;
    }

    return streamObject({
      model: evaluatorModel,
      schema: z.object({
        finalTranslation: z.string(),
        iterationsRequired: z.number(),
        iterationResults: z.array(
          z.object({
            translation: z.string(),
            evaluation: z.object({
              qualityScore: z.number(),
              preservesTone: z.boolean(),
              preservesNuance: z.boolean(),
              culturallyAccurate: z.boolean(),
              specificIssues: z.array(z.string()),
              improvementSuggestions: z.array(z.string()),
            }),
            iteration: z.number(),
          }),
        ),
        originalText: z.string(),
        targetLanguage: z.string(),
      }),
      prompt: `Return the following data as a structured object:\n\nFinal Translation: ${currentTranslation}\nIterations Required: ${iterations}\nIteration Results: ${JSON.stringify(iterationResults)}\nOriginal Text: ${text}\nTarget Language: ${targetLanguage}`,
    }).toTextStreamResponse();
  }
}
