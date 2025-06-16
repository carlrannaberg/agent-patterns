import { Injectable } from '@nestjs/common';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateObject, streamObject } from 'ai';
import { z } from 'zod';

const google = createGoogleGenerativeAI();

@Injectable()
export class OrchestratorWorkerService {
  async implementFeature(featureRequest: string) {
    const orchestratorModel = google('models/gemini-1.5-pro-latest');
    const workerModel = google('models/gemini-1.5-pro-latest');

    const { object: implementationPlan } = await generateObject({
      model: orchestratorModel,
      schema: z.object({
        files: z.array(
          z.object({
            purpose: z.string(),
            filePath: z.string(),
            changeType: z.enum(['create', 'modify', 'delete']),
          }),
        ),
        estimatedComplexity: z.enum(['low', 'medium', 'high']),
      }),
      system:
        'You are a senior software architect planning feature implementations.',
      prompt: `Analyze this feature request and create an implementation plan:\n${featureRequest}`,
    });

    const fileChanges = await Promise.all(
      implementationPlan.files.map(async (file) => {
        const workerSystemPrompts = {
          create:
            'You are a software developer creating new files. Write complete, production-ready code.',
          modify:
            'You are a software developer modifying existing files. Provide clear, targeted changes.',
          delete:
            'You are a software developer removing files. Explain the deletion rationale.',
        };

        const { object: change } = await generateObject({
          model: workerModel,
          schema: z.object({
            explanation: z.string(),
            code: z.string(),
          }),
          system: workerSystemPrompts[file.changeType],
          prompt: `Implement the changes for ${file.filePath} to support:\n${file.purpose}\n\nConsider the overall feature context:\n${featureRequest}`,
        });

        return { file, implementation: change };
      }),
    );

    return streamObject({
      model: orchestratorModel,
      schema: z.object({
        plan: z.object({
          files: z.array(
            z.object({
              purpose: z.string(),
              filePath: z.string(),
              changeType: z.enum(['create', 'modify', 'delete']),
            }),
          ),
          estimatedComplexity: z.enum(['low', 'medium', 'high']),
        }),
        changes: z.array(
          z.object({
            file: z.object({
              purpose: z.string(),
              filePath: z.string(),
              changeType: z.enum(['create', 'modify', 'delete']),
            }),
            implementation: z.object({
              explanation: z.string(),
              code: z.string(),
            }),
          }),
        ),
      }),
      prompt: `Return the following data as a structured object:\n\nPlan: ${JSON.stringify(implementationPlan)}\nChanges: ${JSON.stringify(fileChanges)}`,
    }).toTextStreamResponse();
  }
}
