import { useState } from 'react';
import { Box, Card, Typography, Accordion, AccordionSummary, AccordionDetails, Container } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CodeIcon from '@mui/icons-material/Code';
import AgentInteraction from '../components/AgentInteraction';
import Editor from '@monaco-editor/react';

const exampleCode = `import { openai } from '@ai-sdk/openai';
import { generateText, generateObject } from 'ai';
import { z } from 'zod';

// Example: Parallel code review with multiple specialized reviewers
async function parallelCodeReview(code: string) {
  const model = openai('gpt-4o');

  // Run parallel reviews
  const [securityReview, performanceReview, maintainabilityReview] =
    await Promise.all([
      generateObject({
        model,
        system:
          'You are an expert in code security. Focus on identifying security vulnerabilities, injection risks, and authentication issues.',
        schema: z.object({
          vulnerabilities: z.array(z.string()),
          riskLevel: z.enum(['low', 'medium', 'high']),
          suggestions: z.array(z.string()),
        }),
        prompt: \`Review this code:
      \${code}\`,
      }),

      generateObject({
        model,
        system:
          'You are an expert in code performance. Focus on identifying performance bottlenecks, memory leaks, and optimization opportunities.',
        schema: z.object({
          issues: z.array(z.string()),
          impact: z.enum(['low', 'medium', 'high']),
          optimizations: z.array(z.string()),
        }),
        prompt: \`Review this code:
      \${code}\`,
      }),

      generateObject({
        model,
        system:
          'You are an expert in code quality. Focus on code structure, readability, and adherence to best practices.',
        schema: z.object({
          concerns: z.array(z.string()),
          qualityScore: z.number().min(1).max(10),
          recommendations: z.array(z.string()),
        }),
        prompt: \`Review this code:
      \${code}\`,
      }),
    ]);

  const reviews = [
    { ...securityReview.object, type: 'security' },
    { ...performanceReview.object, type: 'performance' },
    { ...maintainabilityReview.object, type: 'maintainability' },
  ];

  // Aggregate results using another model instance
  const { text: summary } = await generateText({
    model,
    system: 'You are a technical lead summarizing multiple code reviews.',
    prompt: \`Synthesize these code review results into a concise summary with key actions:
    \${JSON.stringify(reviews, null, 2)}\`,
  });

  return { reviews, summary };
}`;

export default function ParallelProcessingPage() {
  const [codeExpanded, setCodeExpanded] = useState(false);

  return (
    <Container maxWidth="lg" sx={{ py: 2 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Parallel Processing
      </Typography>
      
      <Typography variant="body1" color="text.secondary" paragraph sx={{ maxWidth: '960px' }}>
        This pattern demonstrates parallel processing where multiple analyses (security, performance, maintainability) are performed simultaneously on code for comprehensive review.
      </Typography>

      <AgentInteraction
        apiEndpoint="parallel-processing"
        title=""
        description=""
        placeholder="Paste your code here for parallel analysis of security, performance, and maintainability..."
      />

      {/* Code Example */}
      <Card sx={{ mt: 3, width: '100%' }}>
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