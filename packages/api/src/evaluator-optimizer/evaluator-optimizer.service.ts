import { Injectable, Logger } from '@nestjs/common';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText, generateObject, streamObject } from 'ai';
import { z } from 'zod';

const google = createGoogleGenerativeAI();

@Injectable()
export class EvaluatorOptimizerService {
  private readonly logger = new Logger(EvaluatorOptimizerService.name);
  async translateWithFeedback(text: string, targetLanguage: string) {
    this.logger.verbose('Starting translation with iterative feedback process');
    this.logger.debug(`Text length: ${text.length} characters`);
    this.logger.debug(`Target language: ${targetLanguage}`);

    let currentTranslation = '';
    let iterations = 0;
    const MAX_ITERATIONS = 3;
    this.logger.debug(`Maximum iterations allowed: ${MAX_ITERATIONS}`);
    const iterationResults: Array<{
      translation: string;
      evaluation: any;
      iteration: number;
    }> = [];

    const translatorModel = google('models/gemini-2.5-flash-preview-05-20');
    const evaluatorModel = google('models/gemini-2.5-pro-preview-06-05');

    this.logger.verbose('Step 1: Generating initial translation');

    const { text: translation } = await generateText({
      model: translatorModel,
      system:
        'You are an expert literary translator. Focus on preserving tone, nuance, and cultural context.',
      prompt: `Translate this text to ${targetLanguage}, maintaining the original style and meaning:\n\n${text}`,
    });
    currentTranslation = translation;

    this.logger.verbose('Initial translation completed');
    this.logger.debug(
      `Initial translation length: ${currentTranslation.length} characters`,
    );
    this.logger.verbose('Starting evaluation-optimization loop');

    while (iterations < MAX_ITERATIONS) {
      this.logger.debug(
        `Starting iteration ${iterations + 1}/${MAX_ITERATIONS}`,
      );
      this.logger.verbose(
        `Evaluating translation quality - iteration ${iterations + 1}`,
      );

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

      this.logger.debug(
        `Evaluation completed - Quality score: ${evaluation.qualityScore}/10`,
      );
      this.logger.debug(`Issues found: ${evaluation.specificIssues.length}`);

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
        this.logger.verbose(
          `Translation quality threshold met (score: ${evaluation.qualityScore}/10) - stopping optimization`,
        );
        break;
      }

      if (iterations < MAX_ITERATIONS - 1) {
        this.logger.verbose(
          `Generating improved translation based on feedback - iteration ${iterations + 1}`,
        );

        const { text: improvedTranslation } = await generateText({
          model: google('models/gemini-2.5-pro-preview-06-05'),
          system:
            'You are an expert literary translator. Focus on addressing the specific feedback provided.',
          prompt: `Improve this translation based on the following feedback:\n\nSpecific Issues:\n${evaluation.specificIssues.join('\n')}\n\nImprovement Suggestions:\n${evaluation.improvementSuggestions.join('\n')}\n\nOriginal Text: ${text}\nCurrent Translation: ${currentTranslation}\n\nProvide an improved translation to ${targetLanguage}.`,
        });
        currentTranslation = improvedTranslation;
        this.logger.debug(
          `Improved translation generated - length: ${currentTranslation.length} characters`,
        );
      }

      iterations++;
    }

    this.logger.verbose(
      `Translation optimization completed after ${iterations} iterations`,
    );
    this.logger.verbose('Starting final streaming result generation');

    const result = streamObject({
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
    });

    this.logger.verbose(
      'Translation with feedback process completed - streaming results',
    );
    return result;
  }
}
