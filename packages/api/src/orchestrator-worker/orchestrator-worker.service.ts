import { Injectable, Logger } from '@nestjs/common';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateObject, streamObject } from 'ai';
import { z } from 'zod';

const google = createGoogleGenerativeAI();

@Injectable()
export class OrchestratorWorkerService {
  private readonly logger = new Logger(OrchestratorWorkerService.name);
  async implementFeature(featureRequest: string) {
    this.logger.log('Starting feature implementation planning process');
    this.logger.debug(
      `Feature request: ${featureRequest.substring(0, 100)}...`,
    );

    const orchestratorModel = google('models/gemini-2.5-pro-preview-06-05');
    const workerModel = google('models/gemini-2.5-pro-preview-06-05');

    this.logger.log('Generating implementation plan with orchestrator');

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

    this.logger.log('Implementation plan generated successfully');
    this.logger.debug(`Files to change: ${implementationPlan.files.length}`);
    this.logger.debug(
      `Estimated complexity: ${implementationPlan.estimatedComplexity}`,
    );
    this.logger.log('Starting worker execution for each file change');

    const fileChanges = await Promise.all(
      implementationPlan.files.map(async (file, index) => {
        this.logger.debug(
          `Processing file ${index + 1}/${implementationPlan.files.length}: ${file.filePath} (${file.changeType})`,
        );

        const workerSystemPrompts = {
          create:
            'You are a software developer creating new files. Write complete, production-ready code.',
          modify:
            'You are a software developer modifying existing files. Provide clear, targeted changes.',
          delete:
            'You are a software developer removing files. Explain the deletion rationale.',
        };

        this.logger.debug(
          `Generating ${file.changeType} implementation for ${file.filePath}`,
        );

        const { object: change } = await generateObject({
          model: workerModel,
          schema: z.object({
            explanation: z.string(),
            code: z.string(),
          }),
          system: workerSystemPrompts[file.changeType],
          prompt: `Implement the changes for ${file.filePath} to support:\n${file.purpose}\n\nConsider the overall feature context:\n${featureRequest}`,
        });

        this.logger.debug(`Completed implementation for ${file.filePath}`);
        return { file, implementation: change };
      }),
    );

    this.logger.log('All worker executions completed successfully');
    this.logger.debug(`Total implementations generated: ${fileChanges.length}`);
    this.logger.log('Starting final streaming result generation');

    const result = streamObject({
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
    });

    this.logger.log(
      'Feature implementation process completed - streaming results',
    );
    return result;
  }
}
