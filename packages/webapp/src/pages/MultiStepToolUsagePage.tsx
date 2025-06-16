import { useState } from 'react';
import { Box, Card, Typography, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CodeIcon from '@mui/icons-material/Code';
import AgentInteraction from '../components/AgentInteraction';
import Editor from '@monaco-editor/react';

const exampleCode = `import { openai } from '@ai-sdk/openai';
import { generateText, tool, stepCountIs } from 'ai';
import 'dotenv/config';
import { z } from 'zod';
import { mathjs } from 'mathjs';

const { toolCalls } = await generateText({
  model: openai('gpt-4o-2024-08-06'),
  tools: {
    calculate: tool({
      description:
        'A tool for evaluating mathematical expressions. Example expressions: ' +
        "'1.2 * (2 + 4.5)', '12.7 cm to inch', 'sin(45 deg) ^ 2'.",
      parameters: z.object({ expression: z.string() }),
      execute: async ({ expression }) => mathjs.evaluate(expression),
    }),
    // answer tool: the LLM will provide a structured answer
    answer: tool({
      description: 'A tool for providing the final answer.',
      parameters: z.object({
        steps: z.array(
          z.object({
            calculation: z.string(),
            reasoning: z.string(),
          }),
        ),
        answer: z.string(),
      }),
      // no execute function - invoking it will terminate the agent
    }),
  },
  toolChoice: 'required',
  stopWhen: stepCountIs(10),
  system:
    'You are solving math problems. ' +
    'Reason step by step. ' +
    'Use the calculator when necessary. ' +
    'The calculator can only do simple additions, subtractions, multiplications, and divisions. ' +
    'When you give the final answer, provide an explanation for how you got it.',
  prompt:
    'A taxi driver earns $9461 per 1-hour work. ' +
    'If he works 12 hours a day and in 1 hour he uses 14-liters petrol with price $134 for 1-liter. ' +
    'How much money does he earn in one day?',
});

console.log(\`FINAL TOOL CALLS: \${JSON.stringify(toolCalls, null, 2)}\`);`;

export default function MultiStepToolUsagePage() {
  const [codeExpanded, setCodeExpanded] = useState(false);

  return (
    <Box sx={{ maxWidth: '100%', mx: 'auto', p: 2, mt: 0 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Multi-Step Tool Usage
      </Typography>
      
      <Typography variant="body1" color="text.secondary" paragraph>
        This pattern demonstrates multi-step tool usage where complex math problems are solved using calculation tools across multiple steps.
      </Typography>

      {/* Code Example */}
      <Card sx={{ mb: 3 }}>
        <Accordion expanded={codeExpanded} onChange={() => setCodeExpanded(!codeExpanded)}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CodeIcon />
              <Typography variant="h6">Pattern Implementation Example</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 0 }}>
            <Editor
              height="600px"
              defaultLanguage="typescript"
              value={exampleCode}
              options={{
                readOnly: true,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                fontSize: 14,
                lineNumbers: 'on',
                renderWhitespace: 'none',
                wordWrap: 'on',
                theme: 'vs-dark'
              }}
            />
          </AccordionDetails>
        </Accordion>
      </Card>

      <AgentInteraction
        apiEndpoint="multi-step-tool-usage"
        title=""
        description=""
        placeholder="Enter a complex math problem that requires multiple calculation steps..."
      />
    </Box>
  );
}