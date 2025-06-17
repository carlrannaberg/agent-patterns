import { useState } from 'react';
import { Box, Card, Typography, Accordion, AccordionSummary, AccordionDetails, Container } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CodeIcon from '@mui/icons-material/Code';
import AgentInteraction from '../components/AgentInteraction';
import Editor from '@monaco-editor/react';

const exampleCode = `import { openai } from '@ai-sdk/openai';
import { generateText, generateObject } from 'ai';
import { z } from 'zod';

async function translateWithFeedback(text: string, targetLanguage: string) {
  let currentTranslation = '';
  let iterations = 0;
  const MAX_ITERATIONS = 3;

  // Initial translation
  const { text: translation } = await generateText({
    model: openai('gpt-4o-mini'), // use small model for first attempt
    system: 'You are an expert literary translator.',
    prompt: \`Translate this text to \${targetLanguage}, preserving tone and cultural nuances:
    \${text}\`,
  });

  currentTranslation = translation;

  // Evaluation-optimization loop
  while (iterations < MAX_ITERATIONS) {
    // Evaluate current translation
    const { object: evaluation } = await generateObject({
      model: openai('gpt-4o'), // use a larger model to evaluate
      schema: z.object({
        qualityScore: z.number().min(1).max(10),
        preservesTone: z.boolean(),
        preservesNuance: z.boolean(),
        culturallyAccurate: z.boolean(),
        specificIssues: z.array(z.string()),
        improvementSuggestions: z.array(z.string()),
      }),
      system: 'You are an expert in evaluating literary translations.',
      prompt: \`Evaluate this translation:

      Original: \${text}
      Translation: \${currentTranslation}

      Consider:
      1. Overall quality
      2. Preservation of tone
      3. Preservation of nuance
      4. Cultural accuracy\`,
    });

    // Check if quality meets threshold
    if (
      evaluation.qualityScore >= 8 &&
      evaluation.preservesTone &&
      evaluation.preservesNuance &&
      evaluation.culturallyAccurate
    ) {
      break;
    }

    // Generate improved translation based on feedback
    const { text: improvedTranslation } = await generateText({
      model: openai('gpt-4o'), // use a larger model
      system: 'You are an expert literary translator.',
      prompt: \`Improve this translation based on the following feedback:
      \${evaluation.specificIssues.join('\\n')}
      \${evaluation.improvementSuggestions.join('\\n')}

      Original: \${text}
      Current Translation: \${currentTranslation}\`,
    });

    currentTranslation = improvedTranslation;
    iterations++;
  }

  return {
    finalTranslation: currentTranslation,
    iterationsRequired: iterations,
  };
}`;

export default function EvaluatorOptimizerPage() {
  const [codeExpanded, setCodeExpanded] = useState(false);

  return (
    <Container maxWidth="lg" sx={{ py: 2 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Evaluator-Optimizer
      </Typography>
      
      <Typography variant="body1" color="text.secondary" paragraph>
        This pattern demonstrates iterative improvement where translations are evaluated and optimized through multiple rounds for enhanced quality.
      </Typography>

      <AgentInteraction
        apiEndpoint="evaluator-optimizer"
        title=""
        description=""
        placeholder="Enter text to translate with iterative quality improvement. Use [target: language] to specify target language (default: Spanish)..."
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