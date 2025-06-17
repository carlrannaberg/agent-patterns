import { useState } from 'react';
import { Box, Card, Typography, Accordion, AccordionSummary, AccordionDetails, Container } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CodeIcon from '@mui/icons-material/Code';
import AgentInteraction from '../components/AgentInteraction';
import Editor from '@monaco-editor/react';

const exampleCode = `import { openai } from '@ai-sdk/openai';
import { generateText, generateObject } from 'ai';
import { z } from 'zod';

async function generateMarketingCopy(input: string) {
  const model = openai('gpt-4o');

  // First step: Generate marketing copy
  const { text: copy } = await generateText({
    model,
    prompt: \`Write persuasive marketing copy for: \${input}. Focus on benefits and emotional appeal.\`,
  });

  // Perform quality check on copy
  const { object: qualityMetrics } = await generateObject({
    model,
    schema: z.object({
      hasCallToAction: z.boolean(),
      emotionalAppeal: z.number().min(1).max(10),
      clarity: z.number().min(1).max(10),
    }),
    prompt: \`Evaluate this marketing copy for:
    1. Presence of call to action (true/false)
    2. Emotional appeal (1-10)
    3. Clarity (1-10)

    Copy to evaluate: \${copy}\`,
  });

  // If quality check fails, regenerate with more specific instructions
  if (
    !qualityMetrics.hasCallToAction ||
    qualityMetrics.emotionalAppeal < 7 ||
    qualityMetrics.clarity < 7
  ) {
    const { text: improvedCopy } = await generateText({
      model,
      prompt: \`Rewrite this marketing copy with:
      \${!qualityMetrics.hasCallToAction ? '- A clear call to action' : ''}
      \${qualityMetrics.emotionalAppeal < 7 ? '- Stronger emotional appeal' : ''}
      \${qualityMetrics.clarity < 7 ? '- Improved clarity and directness' : ''}

      Original copy: \${copy}\`,
    });
    return { copy: improvedCopy, qualityMetrics };
  }

  return { copy, qualityMetrics };
}`;

export default function SequentialProcessingPage() {
  const [codeExpanded, setCodeExpanded] = useState(false);

  return (
    <Container maxWidth="lg" sx={{ py: 2 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Sequential Processing
      </Typography>
      
      <Typography variant="body1" color="text.secondary" paragraph>
        This pattern demonstrates sequential processing where tasks are executed one after another. The system generates marketing copy and then evaluates its quality in sequence.
      </Typography>

      <AgentInteraction
        apiEndpoint="sequential-processing"
        title=""
        description=""
        placeholder="Enter a product or service you'd like to create marketing copy for..."
      />

      {/* Code Example */}
      <Card sx={{ mt: 3 }}>
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
    </Container>
  );
}