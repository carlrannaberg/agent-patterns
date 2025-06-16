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
  const [object, setObject] = useState<Record<string, unknown> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`http://localhost:3001/${apiEndpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ input: input.trim() }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body reader available');
      }

      const decoder = new TextDecoder();
      let result = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        result += decoder.decode(value, { stream: true });
        
        try {
          const parsed = JSON.parse(result);
          setObject(parsed);
        } catch {
          // Ignore partial JSON parsing errors during streaming
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('An error occurred'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: '100%', mx: 'auto', p: 2 }}>
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
    </Box>
  );
}