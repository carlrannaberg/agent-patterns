import { useState } from 'react';
import { Box, Card, Typography, Accordion, AccordionSummary, AccordionDetails, Container } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CodeIcon from '@mui/icons-material/Code';
import AgentInteraction from '../components/AgentInteraction';
import Editor from '@monaco-editor/react';

const exampleCode = `import { openai } from '@ai-sdk/openai';
import { generateObject, generateText } from 'ai';
import { z } from 'zod';

async function handleCustomerQuery(query: string) {
  const model = openai('gpt-4o');

  // First step: Classify the query type
  const { object: classification } = await generateObject({
    model,
    schema: z.object({
      reasoning: z.string(),
      type: z.enum(['general', 'refund', 'technical']),
      complexity: z.enum(['simple', 'complex']),
    }),
    prompt: \`Classify this customer query:
    \${query}

    Determine:
    1. Query type (general, refund, or technical)
    2. Complexity (simple or complex)
    3. Brief reasoning for classification\`,
  });

  // Route based on classification
  // Set model and system prompt based on query type and complexity
  const { text: response } = await generateText({
    model:
      classification.complexity === 'simple'
        ? openai('gpt-4o-mini')
        : openai('o3-mini'),
    system: {
      general:
        'You are an expert customer service agent handling general inquiries.',
      refund:
        'You are a customer service agent specializing in refund requests. Follow company policy and collect necessary information.',
      technical:
        'You are a technical support specialist with deep product knowledge. Focus on clear step-by-step troubleshooting.',
    }[classification.type],
    prompt: query,
  });

  return { response, classification };
}`;

export default function RoutingPage() {
  const [codeExpanded, setCodeExpanded] = useState(false);

  return (
    <Container maxWidth="lg" sx={{ py: 2 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Routing
      </Typography>
      
      <Typography variant="body1" color="text.secondary" paragraph>
        This pattern demonstrates intelligent routing where customer queries are classified and routed to specialized handlers for appropriate responses.
      </Typography>

      <AgentInteraction
        apiEndpoint="routing"
        title=""
        description=""
        placeholder="Enter a customer query (e.g., 'I want to return my product', 'How do I use feature X?', 'What are your pricing plans?')..."
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