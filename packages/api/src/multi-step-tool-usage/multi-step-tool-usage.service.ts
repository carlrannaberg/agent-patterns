import { Injectable, Logger } from '@nestjs/common';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText, tool, streamObject } from 'ai';
import * as mathjs from 'mathjs';
import { z } from 'zod';

const google = createGoogleGenerativeAI();

@Injectable()
export class MultiStepToolUsageService {
  private readonly logger = new Logger(MultiStepToolUsageService.name);
  async solveMathProblem(prompt: string) {
    this.logger.verbose('Starting multi-step math problem solving process');
    this.logger.debug(`Problem: ${prompt}`);

    const model = google('models/gemini-2.5-pro-preview-06-05');

    this.logger.verbose('Initiating tool-assisted problem solving');

    const { toolCalls, text, toolResults } = await generateText({
      model,
      tools: {
        calculate: tool({
          description:
            'A tool for evaluating mathematical expressions. Use this for any calculations needed to solve the problem.',
          parameters: z.object({
            expression: z.string().describe('The mathematical expression to evaluate'),
          }),
          execute: async ({ expression }) => {
            this.logger.debug(`Calculating expression: ${expression}`);
            try {
              const result = mathjs.evaluate(expression) as number | string;
              this.logger.debug(`Calculation result: ${expression} = ${result}`);
              return Promise.resolve({ result: String(result), expression });
            } catch (error: unknown) {
              this.logger.warn(
                `Calculation error for expression '${expression}': ${error instanceof Error ? error.message : 'Unknown error'}`,
              );
              return Promise.resolve({
                error: `Error evaluating expression: ${error instanceof Error ? error.message : 'Unknown error'}`,
                expression,
              });
            }
          },
        }),
        answer: tool({
          description:
            'A tool for providing the final answer to the math problem with step-by-step reasoning.',
          parameters: z.object({
            steps: z.array(
              z.object({
                calculation: z.string().describe('The calculation performed'),
                reasoning: z.string().describe('The reasoning behind this step'),
              }),
            ),
            answer: z.string().describe('The final answer to the problem'),
          }),
        }),
      },
      toolChoice: 'required',
      system:
        'You are solving math problems step by step. Use the calculate tool for any mathematical operations, then provide the final answer with the answer tool.',
      prompt: prompt,
    });

    this.logger.verbose('Tool execution completed');
    this.logger.debug(`Total tool calls made: ${toolCalls.length}`);

    const finalAnswer = toolCalls.find((call) => call.toolName === 'answer');
    const calculations = toolCalls.filter((call) => call.toolName === 'calculate');

    this.logger.debug(`Number of calculations performed: ${calculations.length}`);
    this.logger.debug(`Final answer tool called: ${finalAnswer ? 'Yes' : 'No'}`);

    const calculationResults = calculations.map((calc, index) => {
      const toolResult = toolResults.find(
        (r: { toolCallId: string; result: unknown }) => r.toolCallId === calc.toolCallId,
      );
      const resultValue =
        toolResult &&
        typeof toolResult.result === 'object' &&
        toolResult.result !== null &&
        'result' in toolResult.result
          ? (toolResult.result as { result?: string }).result
          : 'Error';
      return {
        expression: String((calc.args as { expression?: string })?.expression || ''),
        result: resultValue || 'Error',
        step: index + 1,
      };
    });

    this.logger.verbose('Processing calculation results and generating structured response');
    this.logger.debug(`Successfully processed ${calculationResults.length} calculation steps`);
    this.logger.verbose('Starting final streaming result generation');

    const result = streamObject({
      model,
      schema: z.object({
        problem: z.string(),
        calculations: z.array(
          z.object({
            expression: z.string(),
            result: z.string(),
            step: z.number(),
          }),
        ),
        steps: z.array(
          z.object({
            calculation: z.string(),
            reasoning: z.string(),
          }),
        ),
        finalAnswer: z.string(),
        workingSteps: z.string(),
      }),
      prompt: `Return the following data as a structured object:\n\nProblem: ${prompt}\nCalculations performed: ${JSON.stringify(calculationResults)}\nSteps: ${JSON.stringify((finalAnswer?.args as { steps?: unknown[] })?.steps || [])}\nFinal Answer: ${(finalAnswer?.args as { answer?: string })?.answer || 'No answer provided'}\nWorking Steps: ${text}`,
    });

    this.logger.verbose('Multi-step math problem solving completed - streaming results');
    return result;
  }
}
