import { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Typography,
} from '@mui/material';
import TextareaAutosize from 'react-textarea-autosize';
import { experimental_useObject as useObject } from '@ai-sdk/react';
import { z } from 'zod';
import SequentialProcessingDisplay from './SequentialProcessingDisplay';
import RoutingDisplay from './RoutingDisplay';
import ParallelProcessingDisplay from './ParallelProcessingDisplay';
import OrchestratorWorkerDisplay from './OrchestratorWorkerDisplay';
import EvaluatorOptimizerDisplay from './EvaluatorOptimizerDisplay';
import MultiStepToolUsageDisplay from './MultiStepToolUsageDisplay';

interface AgentInteractionProps {
  apiEndpoint: string;
  title: string;
  description: string;
  placeholder?: string;
}

export default function AgentInteraction({
  apiEndpoint,
  title,
  description,
  placeholder = 'Enter your input here...',
}: AgentInteractionProps) {
  const [input, setInput] = useState('');
  
  const { object, submit, isLoading, error } = useObject({
    api: `http://localhost:3001/${apiEndpoint}`,
    schema: z.any(), // Generic schema for any object structure
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    await submit({ input: input.trim() });
  };

  return (
    <Box sx={{ maxWidth: '100%', mx: 'auto', p: 2, mt: 0 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        {title}
      </Typography>
      
      <Typography variant="body1" color="text.secondary" paragraph>
        {description}
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <Box sx={{ mb: 2 }}>
              <TextareaAutosize
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={placeholder}
                minRows={3}
                maxRows={10}
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  resize: 'vertical',
                }}
              />
            </Box>
            <Button
              type="submit"
              variant="contained"
              disabled={!input.trim() || isLoading}
              startIcon={isLoading ? <CircularProgress size={20} /> : null}
            >
              {isLoading ? 'Processing...' : 'Submit'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {error && (
        <Card sx={{ mb: 3, borderColor: 'error.main' }}>
          <CardContent>
            <Typography variant="h6" color="error" gutterBottom>
              Error
            </Typography>
            <Typography variant="body2" color="error">
              {error.message || 'An error occurred while processing your request.'}
            </Typography>
          </CardContent>
        </Card>
      )}

      {object && (
        <>
          {apiEndpoint === 'sequential-processing' ? (
            <SequentialProcessingDisplay result={object} />
          ) : apiEndpoint === 'routing' ? (
            <RoutingDisplay result={object} />
          ) : apiEndpoint === 'parallel-processing' ? (
            <ParallelProcessingDisplay result={object} />
          ) : apiEndpoint === 'orchestrator-worker' ? (
            <OrchestratorWorkerDisplay result={object} />
          ) : apiEndpoint === 'evaluator-optimizer' ? (
            <EvaluatorOptimizerDisplay result={object} />
          ) : apiEndpoint === 'multi-step-tool-usage' ? (
            <MultiStepToolUsageDisplay result={object} />
          ) : (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Response
                </Typography>
                <Box
                  component="pre"
                  sx={{
                    backgroundColor: '#f5f5f5',
                    p: 2,
                    borderRadius: 1,
                    overflow: 'auto',
                    fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                    fontSize: '14px',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {JSON.stringify(object, null, 2)}
                </Box>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </Box>
  );
}