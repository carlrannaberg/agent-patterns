import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
} from '@mui/material';
import { Link } from 'react-router-dom';

const patterns = [
  {
    title: 'Sequential Processing',
    description: 'Tasks executed one after another, like generating and evaluating marketing copy.',
    path: '/sequential-processing',
  },
  {
    title: 'Routing',
    description: 'Intelligent query classification and routing to specialized handlers.',
    path: '/routing',
  },
  {
    title: 'Parallel Processing',
    description: 'Multiple analyses performed simultaneously for comprehensive code review.',
    path: '/parallel-processing',
  },
  {
    title: 'Orchestrator-Worker',
    description: 'Orchestrator manages multiple workers for complex feature implementation.',
    path: '/orchestrator-worker',
  },
  {
    title: 'Evaluator-Optimizer',
    description: 'Iterative improvement through evaluation and optimization cycles.',
    path: '/evaluator-optimizer',
  },
  {
    title: 'Multi-Step Tool Usage',
    description: 'Complex problem solving using tools across multiple coordinated steps.',
    path: '/multi-step-tool-usage',
  },
];

export default function HomePage() {
  return (
    <Box>
      <Typography variant="h3" component="h1" gutterBottom>
        AI Agent Patterns Demo
      </Typography>
      
      <Typography variant="body1" color="text.secondary" paragraph>
        Explore six different AI agent patterns that demonstrate various approaches to handling complex tasks.
        Each pattern showcases a different architectural approach to building intelligent systems.
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            md: 'repeat(2, 1fr)',
            lg: 'repeat(3, 1fr)',
          },
          gap: 3,
          mt: 2,
        }}
      >
        {patterns.map((pattern) => (
          <Card key={pattern.path} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
              <Typography variant="h6" component="h2" gutterBottom>
                {pattern.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph sx={{ flexGrow: 1 }}>
                {pattern.description}
              </Typography>
              <Button
                component={Link}
                to={pattern.path}
                variant="contained"
                size="small"
                sx={{ mt: 'auto' }}
              >
                Try It Out
              </Button>
            </CardContent>
          </Card>
        ))}
      </Box>
    </Box>
  );
}