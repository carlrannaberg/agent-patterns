# Agent Patterns Repository Implementation Plan

## Notes
- **Monorepo**: Use `pnpm workspaces` to manage the `api` (backend) and `webapp` (frontend) packages.
- **Backend**: A Nest.js application. Each agent pattern will be implemented in its own module.
- **Frontend**: A React.js application built with Vite and Material UI. Each pattern will have its own page.
- **Streaming & API Communication**:
  - The Nest.js backend will use the Vercel AI SDK's `streamObject` function to stream JSON responses.
  - The React frontend will use the `useObject` hook from `ai/react` to consume and render the streamed data.
  - The Nest.js application must have CORS enabled to allow requests from the frontend development server.
- **Environment Variables**: Use `dotenv` for API keys in the backend.
- **Testing**: Use Vitest for API-level tests.
- **Code Quality**: Use ESLint, and Husky with lint-staged for a consistent and high-quality codebase.

# Tasks

- [ ] 1.0 **Project & Developer Experience Setup**
  - [ ] 1.1 Initialize a Git monorepo with `pnpm workspaces` (`packages/api`, `packages/webapp`).
  - [ ] 1.2 Create the Nest.js app in `packages/api` and the React/Vite app in `packages/webapp`.
  - [ ] 1.3 **Code Quality Tooling**: Install and configure ESLint, TypeScript, Husky, and lint-staged at the project root with corresponding scripts.
  - [ ] 1.4 **Dependencies**
    - [ ] 1.4.1 In `api`: install `dotenv`, `@ai-sdk/openai`, `zod`, and `mathjs`.
    - [ ] 1.4.2 In `webapp`: install `ai`, `@ai-sdk/react`, `@mui/material`, `@emotion/react`, `@emotion/styled`, `react-router-dom`, `react-textarea-autosize`.

- [ ] 2.0 **Backend (Nest.js) Implementation**
  - [ ] 2.1 Enable CORS in `main.ts` in the `api` package.
  - [ ] 2.2 **Sequential Processing Module (`/sequential-processing`)**
    - [ ] 2.2.1 Generate the `sequential-processing` module.
    - [ ] 2.2.2 Implement the `SequentialProcessingController` to accept a `POST` request and pipe the stream from the service.
    - [ ] 2.2.3 Implement the `SequentialProcessingService`. Adapt the logic below to use streaming (e.g., with `streamObject`).
      ```typescript
      // packages/api/src/sequential-processing/sequential-processing.service.ts
      import { openai } from '@ai-sdk/openai';
      import { generateText, generateObject } from 'ai';
      import { z } from 'zod';

      async function generateMarketingCopy(input: string) {
        const model = openai('gpt-4o');

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

        if (!qualityMetrics.hasCallToAction || qualityMetrics.emotionalAppeal < 7 || qualityMetrics.clarity < 7) {
          const { text: improvedCopy } = await generateText({
            model,
            prompt: `Rewrite this marketing copy with:\n${!qualityMetrics.hasCallToAction ? '- A clear call to action' : ''}\n${qualityMetrics.emotionalAppeal < 7 ? '- Stronger emotional appeal' : ''}\n${qualityMetrics.clarity < 7 ? '- Improved clarity and directness' : ''}\n\nOriginal copy: ${copy}`,
          });
          return { copy: improvedCopy, qualityMetrics };
        }

        return { copy, qualityMetrics };
      }
      ```
  - [ ] 2.3 **Routing Module (`/routing`)**
    - [ ] 2.3.1 Generate the `routing` module.
    - [ ] 2.3.2 Implement the `RoutingController`.
    - [ ] 2.3.3 Implement the `RoutingService`, adapting the logic below for streaming.
      ```typescript
      // packages/api/src/routing/routing.service.ts
      import { openai } from '@ai-sdk/openai';
      import { generateObject, generateText } from 'ai';
      import { z } from 'zod';

      async function handleCustomerQuery(query: string) {
        const model = openai('gpt-4o');

        const { object: classification } = await generateObject({
          model,
          schema: z.object({
            reasoning: z.string(),
            type: z.enum(['general', 'refund', 'technical']),
            complexity: z.enum(['simple', 'complex']),
          }),
          prompt: `Classify this customer query:\n${query}\n\nDetermine:\n1. Query type (general, refund, or technical)\n2. Complexity (simple or complex)\n3. Brief reasoning for classification`,
        });

        const { text: response } = await generateText({
          model: classification.complexity === 'simple' ? openai('gpt-4o-mini') : openai('o3-mini'),
          system: {
            general: 'You are an expert customer service agent handling general inquiries.',
            refund: 'You are a customer service agent specializing in refund requests. Follow company policy and collect necessary information.',
            technical: 'You are a technical support specialist with deep product knowledge. Focus on clear step-by-step troubleshooting.',
          }[classification.type],
          prompt: query,
        });

        return { response, classification };
      }
      ```
  - [ ] 2.4 **Parallel Processing Module (`/parallel-processing`)**
    - [ ] 2.4.1 Generate the `parallel-processing` module.
    - [ ] 2.4.2 Implement the `ParallelProcessingController`.
    - [ ] 2.4.3 Implement the `ParallelProcessingService`, adapting the logic below for streaming the final summary.
      ```typescript
      // packages/api/src/parallel-processing/parallel-processing.service.ts
      import { openai } from '@ai-sdk/openai';
      import { generateText, generateObject } from 'ai';
      import { z } from 'zod';

      async function parallelCodeReview(code: string) {
        const model = openai('gpt-4o');

        const [securityReview, performanceReview, maintainabilityReview] = await Promise.all([
          generateObject({ model, system: 'You are an expert in code security...', schema: z.object({ vulnerabilities: z.array(z.string()), riskLevel: z.enum(['low', 'medium', 'high']), suggestions: z.array(z.string()) }), prompt: `Review this code:\n${code}` }),
          generateObject({ model, system: 'You are an expert in code performance...', schema: z.object({ issues: z.array(z.string()), impact: z.enum(['low', 'medium', 'high']), optimizations: z.array(z.string()) }), prompt: `Review this code:\n${code}` }),
          generateObject({ model, system: 'You are an expert in code quality...', schema: z.object({ concerns: z.array(z.string()), qualityScore: z.number().min(1).max(10), recommendations: z.array(z.string()) }), prompt: `Review this code:\n${code}` }),
        ]);

        const reviews = [
          { ...securityReview.object, type: 'security' },
          { ...performanceReview.object, type: 'performance' },
          { ...maintainabilityReview.object, type: 'maintainability' },
        ];

        const { text: summary } = await generateText({
          model,
          system: 'You are a technical lead summarizing multiple code reviews.',
          prompt: `Synthesize these code review results into a concise summary with key actions:\n${JSON.stringify(reviews, null, 2)}`,
        });

        return { reviews, summary };
      }
      ```
  - [ ] 2.5 **Orchestrator-Worker Module (`/orchestrator-worker`)**
    - [ ] 2.5.1 Generate the `orchestrator-worker` module.
    - [ ] 2.5.2 Implement the `OrchestratorWorkerController`.
    - [ ] 2.5.3 Implement the `OrchestratorWorkerService`, adapting the logic below for streaming.
      ```typescript
      // packages/api/src/orchestrator-worker/orchestrator-worker.service.ts
      import { openai } from '@ai-sdk/openai';
      import { generateObject } from 'ai';
      import { z } from 'zod';

      async function implementFeature(featureRequest: string) {
        const { object: implementationPlan } = await generateObject({
          model: openai('o3-mini'),
          schema: z.object({ files: z.array(z.object({ purpose: z.string(), filePath: z.string(), changeType: z.enum(['create', 'modify', 'delete']) })), estimatedComplexity: z.enum(['low', 'medium', 'high']) }),
          system: 'You are a senior software architect planning feature implementations.',
          prompt: `Analyze this feature request and create an implementation plan:\n${featureRequest}`,
        });

        const fileChanges = await Promise.all(
          implementationPlan.files.map(async file => {
            const workerSystemPrompt = { create: '...', modify: '...', delete: '...' }[file.changeType];
            const { object: change } = await generateObject({ model: openai('gpt-4o'), schema: z.object({ explanation: z.string(), code: z.string() }), system: workerSystemPrompt, prompt: `Implement the changes for ${file.filePath} to support:\n${file.purpose}\n\nConsider the overall feature context:\n${featureRequest}` });
            return { file, implementation: change };
          }),
        );

        return { plan: implementationPlan, changes: fileChanges };
      }
      ```
  - [ ] 2.6 **Evaluator-Optimizer Module (`/evaluator-optimizer`)**
    - [ ] 2.6.1 Generate the `evaluator-optimizer` module.
    - [ ] 2.6.2 Implement the `EvaluatorOptimizerController`.
    - [ ] 2.6.3 Implement the `EvaluatorOptimizerService`, adapting the logic below for streaming.
      ```typescript
      // packages/api/src/evaluator-optimizer/evaluator-optimizer.service.ts
      import { openai } from '@ai-sdk/openai';
      import { generateText, generateObject } from 'ai';
      import { z } from 'zod';

      async function translateWithFeedback(text: string, targetLanguage: string) {
        let currentTranslation = '';
        let iterations = 0;
        const MAX_ITERATIONS = 3;

        const { text: translation } = await generateText({ model: openai('gpt-4o-mini'), system: 'You are an expert literary translator.', prompt: `Translate this text to ${targetLanguage}...\n${text}` });
        currentTranslation = translation;

        while (iterations < MAX_ITERATIONS) {
          const { object: evaluation } = await generateObject({ model: openai('gpt-4o'), schema: z.object({ qualityScore: z.number().min(1).max(10), preservesTone: z.boolean(), preservesNuance: z.boolean(), culturallyAccurate: z.boolean(), specificIssues: z.array(z.string()), improvementSuggestions: z.array(z.string()) }), system: 'You are an expert in evaluating literary translations.', prompt: `Evaluate this translation:\n\nOriginal: ${text}\nTranslation: ${currentTranslation}` });
          if (evaluation.qualityScore >= 8 && evaluation.preservesTone && evaluation.preservesNuance && evaluation.culturallyAccurate) break;
          const { text: improvedTranslation } = await generateText({ model: openai('gpt-4o'), system: 'You are an expert literary translator.', prompt: `Improve this translation based on the following feedback:\n${evaluation.specificIssues.join('\n')}\n${evaluation.improvementSuggestions.join('\n')}\n\nOriginal: ${text}\nCurrent Translation: ${currentTranslation}` });
          currentTranslation = improvedTranslation;
          iterations++;
        }

        return { finalTranslation: currentTranslation, iterationsRequired: iterations };
      }
      ```
  - [ ] 2.7 **Multi-Step Tool Usage Module (`/multi-step-tool-usage`)**
    - [ ] 2.7.1 Generate the `multi-step-tool-usage` module.
    - [ ] 2.7.2 Implement the `MultiStepToolUsageController`.
    - [ ] 2.7.3 Implement the `MultiStepToolUsageService`, adapting the logic below for streaming a structured answer.
      ```typescript
      // packages/api/src/multi-step-tool-usage/multi-step-tool-usage.service.ts
      import { openai } from '@ai-sdk/openai';
      import { generateText, tool, stepCountIs } from 'ai';
      import * as mathjs from 'mathjs';
      import { z } from 'zod';

      async function solveMathProblem(prompt: string) {
        const { toolCalls, ... } = await generateText({
          model: openai('gpt-4o-2024-08-06'),
          tools: {
            calculate: tool({ description: 'A tool for evaluating mathematical expressions...', parameters: z.object({ expression: z.string() }), execute: async ({ expression }) => mathjs.evaluate(expression) }),
            answer: tool({ description: 'A tool for providing the final answer.', parameters: z.object({ steps: z.array(z.object({ calculation: z.string(), reasoning: z.string() })), answer: z.string() }) }),
          },
          toolChoice: 'required',
          stopWhen: stepCountIs(10),
          system: 'You are solving math problems...',
          prompt: prompt,
        });

        // The result to stream will be the arguments of the 'answer' tool call
        const finalAnswer = toolCalls.find(call => call.toolName === 'answer');
        return finalAnswer?.args;
      }
      ```

- [ ] 3.0 **Frontend (React) Implementation**
  - [ ] 3.1 Configure `react-router-dom` with routes for each of the six patterns.
  - [ ] 3.2 Create a main `Layout` component with navigation links to each pattern's page.
  - [ ] 3.3 Create a reusable `AgentInteraction` component.
    - [ ] 3.3.1 It should use the `useObject` hook to manage state and API communication.
    - [ ] 3.3.2 Include a `react-textarea-autosize` input and a submit button.
    - [ ] 3.3.3 Display the streamed `object` from the hook in a `<pre>` tag.
  - [ ] 3.4 Create the six page components, each using `AgentInteraction` and providing the correct API endpoint path.

- [ ] 4.0 **API Testing**
  - [ ] 4.1 Configure Vitest in the `api` package.
  - [ ] 4.2 Write API tests for each of the six endpoints, mocking the AI SDK calls to ensure the services are wired correctly.