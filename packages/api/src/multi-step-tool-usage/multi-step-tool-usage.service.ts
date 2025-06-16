import { Injectable } from '@nestjs/common';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText, tool, streamObject } from 'ai';
import * as mathjs from 'mathjs';
import { z } from 'zod';

const google = createGoogleGenerativeAI();

@Injectable()
export class MultiStepToolUsageService {
  async solveMathProblem(prompt: string) {
    const model = google('models/gemini-1.5-pro-latest');

    const { toolCalls, text, toolResults } = await generateText({
      model,
      tools: {
        calculate: tool({
          description:
            'A tool for evaluating mathematical expressions. Use this for any calculations needed to solve the problem.',
          parameters: z.object({
            expression: z
              .string()
              .describe('The mathematical expression to evaluate'),
          }),
          execute: async ({ expression }) => {
            try {
              const result = mathjs.evaluate(expression) as number | string;
              return { result: String(result), expression };
            } catch (error: unknown) {
              return {
                error: `Error evaluating expression: ${error instanceof Error ? error.message : 'Unknown error'}`,
                expression,
              };
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
                reasoning: z
                  .string()
                  .describe('The reasoning behind this step'),
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

    const finalAnswer = toolCalls.find((call) => call.toolName === 'answer');
    const calculations = toolCalls.filter(
      (call) => call.toolName === 'calculate',
    );

    const calculationResults = calculations.map((calc, index) => {
      const toolResult = toolResults.find(
        (r: any) => r.toolCallId === calc.toolCallId,
      );
      const resultValue =
        toolResult &&
        typeof toolResult.result === 'object' &&
        toolResult.result !== null &&
        'result' in toolResult.result
          ? (toolResult.result as { result?: string }).result
          : 'Error';
      return {
        expression: String((calc.args as any)?.expression || ''),
        result: resultValue || 'Error',
        step: index + 1,
      };
    });

    return streamObject({
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
      prompt: `Return the following data as a structured object:\n\nProblem: ${prompt}\nCalculations performed: ${JSON.stringify(calculationResults)}\nSteps: ${JSON.stringify((finalAnswer?.args as any)?.steps || [])}\nFinal Answer: ${(finalAnswer?.args as any)?.answer || 'No answer provided'}\nWorking Steps: ${text}`,
    }).toTextStreamResponse();
  }
}
