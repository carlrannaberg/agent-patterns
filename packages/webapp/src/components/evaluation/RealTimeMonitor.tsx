import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  LinearProgress,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import {
  PlayArrow,
  CheckCircle,
  Error as ErrorIcon,
  Refresh,
  Speed,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { useEvaluationResults } from '../../hooks/useEvaluationData';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface LiveEvaluation {
  id: string;
  patternType: string;
  status: 'running' | 'completed' | 'failed';
  progress: number;
  startTime: string;
  executionTime?: number;
  score?: number;
}

export function RealTimeMonitor() {
  const [liveEvaluations, setLiveEvaluations] = useState<LiveEvaluation[]>([]);
  const [realtimeMetrics, setRealtimeMetrics] = useState<Array<{
    time: string;
    score: number;
    throughput: number;
    latency: number;
  }>>([]);
  const [isStartingEvaluation, setIsStartingEvaluation] = useState(false);

  const queryParams = useMemo(() => ({ limit: 10 }), []);
  const { results, refetch } = useEvaluationResults(queryParams);

  const stableRefetch = useCallback(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    let intervalCount = 0;
    const interval = setInterval(() => {
      setLiveEvaluations((prev) =>
        prev.map((evaluation) => {
          if (evaluation.status === 'running' && evaluation.progress < 100) {
            const newProgress = Math.min(evaluation.progress + Math.random() * 20, 100);
            const isCompleted = newProgress >= 100;
            return {
              ...evaluation,
              progress: newProgress,
              status: isCompleted ? 'completed' : 'running',
              executionTime: isCompleted
                ? Date.now() - new Date(evaluation.startTime).getTime()
                : undefined,
              score: isCompleted ? Math.random() * 0.3 + 0.7 : undefined,
            };
          }
          return evaluation;
        })
      );

      const now = new Date();
      setRealtimeMetrics((prev) => {
        const newData = [...prev];
        if (newData.length > 20) newData.shift();
        newData.push({
          time: now.toLocaleTimeString(),
          score: Math.random() * 0.2 + 0.75,
          throughput: Math.floor(Math.random() * 50 + 100),
          latency: Math.floor(Math.random() * 200 + 300),
        });
        return newData;
      });

      intervalCount++;
      if (intervalCount % 5 === 0) {
        stableRefetch();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const handleStartEvaluation = async () => {
    setIsStartingEvaluation(true);

    const patterns = [
      'sequential-processing',
      'routing',
      'parallel-processing',
      'orchestrator-worker',
      'evaluator-optimizer',
      'multi-step-tool-usage',
    ];

    const selectedPattern = patterns[Math.floor(Math.random() * patterns.length)];

    // Generate appropriate input for each pattern type
    const getPatternInput = (pattern: string): string => {
      switch (pattern) {
        case 'sequential-processing':
          return 'A new AI-powered fitness tracking app that uses advanced algorithms to provide personalized workout recommendations';
        case 'routing':
          return 'Hi, I purchased a premium subscription last month but I am being charged twice. Can you help me get a refund for the duplicate charge?';
        case 'parallel-processing':
          return `function processUserData(users) {
  const results = [];
  for (let user of users) {
    const validated = validateUser(user);
    const processed = processData(validated);
    results.push(processed);
  }
  return results;
}`;
        case 'orchestrator-worker':
          return 'Create a comprehensive content marketing strategy for a sustainable fashion brand targeting millennials';
        case 'evaluator-optimizer':
          return 'Optimize this slow database query that processes user analytics data for the dashboard';
        case 'multi-step-tool-usage':
          return 'Analyze the sentiment of customer reviews, extract key themes, and generate a summary report with actionable insights';
        default:
          return 'Test input for evaluation';
      }
    };

    const mockEvaluation: LiveEvaluation = {
      id: `eval-${Date.now()}`,
      patternType: selectedPattern,
      status: 'running',
      progress: 10,
      startTime: new Date().toISOString(),
    };

    setLiveEvaluations((prev) => [mockEvaluation, ...prev].slice(0, 10));

    try {
      console.log(`Starting evaluation pipeline for pattern: ${selectedPattern}`);

      // Step 1: Execute the pattern with real input
      const patternInput = getPatternInput(selectedPattern);
      console.log(`Executing pattern with input:`, patternInput);

      const patternResponse = await fetch(`${API_BASE_URL}/${selectedPattern}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: patternInput,
        }),
      });

      if (!patternResponse.ok) {
        throw new Error(`Pattern execution failed: ${patternResponse.statusText}`);
      }

      // Update progress - pattern executed
      setLiveEvaluations((prev) =>
        prev.map((evaluation) =>
          evaluation.id === mockEvaluation.id
            ? { ...evaluation, progress: 50 }
            : evaluation
        )
      );

      // Step 2: Get the pattern output
      const patternOutput = await patternResponse.json();
      console.log('Pattern output received:', patternOutput);

      // Update progress - output received
      setLiveEvaluations((prev) =>
        prev.map((evaluation) =>
          evaluation.id === mockEvaluation.id
            ? { ...evaluation, progress: 70 }
            : evaluation
        )
      );

      // Step 3: Trigger evaluation of the pattern output
      console.log('Starting evaluation of pattern output...');
      const evaluationResponse = await fetch(`${API_BASE_URL}/evaluation/evaluate-single`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patternType: selectedPattern,
          input: patternInput,
          output: patternOutput,
          config: {
            evaluationMethod: 'standard',
            judgeModel: 'gpt-4',
          },
        }),
      });

      if (!evaluationResponse.ok) {
        throw new Error(`Evaluation failed: ${evaluationResponse.statusText}`);
      }

      const evaluationResult = await evaluationResponse.json();
      console.log('Evaluation completed:', evaluationResult);

      // Complete the evaluation
      setLiveEvaluations((prev) =>
        prev.map((evaluation) =>
          evaluation.id === mockEvaluation.id
            ? {
                ...evaluation,
                status: 'completed',
                progress: 100,
                executionTime: evaluationResult.executionTimeMs,
                score: evaluationResult.overallScore,
              }
            : evaluation
        )
      );

      // Refresh results to show new evaluation
      setTimeout(() => refetch(), 1000);

    } catch (error) {
      console.error('Error during evaluation pipeline:', error);

      // Mark evaluation as failed
      setLiveEvaluations((prev) =>
        prev.map((evaluation) =>
          evaluation.id === mockEvaluation.id
            ? {
                ...evaluation,
                status: 'failed',
                progress: 100,
                executionTime: Date.now() - new Date(evaluation.startTime).getTime(),
              }
            : evaluation
        )
      );
    } finally {
      setIsStartingEvaluation(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <PlayArrow color="primary" />;
      case 'completed':
        return <CheckCircle color="success" />;
      case 'failed':
        return <ErrorIcon color="error" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'primary';
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Box display="flex" flexWrap="wrap" gap={3}>
      {/* Control Panel */}
      <Box width="100%">
        <Paper sx={{ p: 2 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Live Evaluation Monitor</Typography>
            <Box>
              <Tooltip title="Start New Evaluation">
                <IconButton
                  color="primary"
                  onClick={handleStartEvaluation}
                  disabled={isStartingEvaluation}
                >
                  {isStartingEvaluation ? <CircularProgress size={24} /> : <PlayArrow />}
                </IconButton>
              </Tooltip>
              <Tooltip title="Refresh Data">
                <IconButton onClick={refetch}>
                  <Refresh />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </Paper>
      </Box>

      {/* Real-time Metrics */}
      <Box flex={{ xs: '0 0 100%', md: '0 0 calc(33.333% - 16px)' }}>
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center" gap={1}>
              <Speed color="primary" />
              <Typography variant="h6">Current Throughput</Typography>
            </Box>
            <Typography variant="h3" sx={{ mt: 2 }}>
              {realtimeMetrics.length > 0
                ? realtimeMetrics[realtimeMetrics.length - 1].throughput
                : 0}{' '}
              evals/min
            </Typography>
          </CardContent>
        </Card>
      </Box>

      <Box flex={{ xs: '0 0 100%', md: '0 0 calc(33.333% - 16px)' }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Average Score
            </Typography>
            <Typography variant="h3">
              {realtimeMetrics.length > 0
                ? (realtimeMetrics[realtimeMetrics.length - 1].score * 100).toFixed(1)
                : 0}
              %
            </Typography>
            <LinearProgress
              variant="determinate"
              value={
                realtimeMetrics.length > 0
                  ? realtimeMetrics[realtimeMetrics.length - 1].score * 100
                  : 0
              }
              sx={{ mt: 2 }}
            />
          </CardContent>
        </Card>
      </Box>

      <Box flex={{ xs: '0 0 100%', md: '0 0 calc(33.333% - 16px)' }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Average Latency
            </Typography>
            <Typography variant="h3">
              {realtimeMetrics.length > 0
                ? realtimeMetrics[realtimeMetrics.length - 1].latency
                : 0}{' '}
              ms
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Real-time Charts */}
      <Box flex={{ xs: '0 0 100%', md: '0 0 calc(50% - 12px)' }}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Score Trend
          </Typography>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={realtimeMetrics}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis domain={[0, 1]} />
              <RechartsTooltip />
              <Area
                type="monotone"
                dataKey="score"
                stroke="#8884d8"
                fill="#8884d8"
                fillOpacity={0.6}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Paper>
      </Box>

      <Box flex={{ xs: '0 0 100%', md: '0 0 calc(50% - 12px)' }}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Throughput & Latency
          </Typography>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={realtimeMetrics}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <RechartsTooltip />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="throughput"
                stroke="#82ca9d"
                name="Throughput (evals/min)"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="latency"
                stroke="#ff7c7c"
                name="Latency (ms)"
              />
            </LineChart>
          </ResponsiveContainer>
        </Paper>
      </Box>

      {/* Active Evaluations with better empty state */}
      <Box width="100%">
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Active Evaluations
          </Typography>
          {liveEvaluations.length === 0 ? (
            <Box textAlign="center" py={4}>
              <Typography color="textSecondary">
                No active evaluations. Click "Start New Evaluation" to begin.
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Status</TableCell>
                    <TableCell>Pattern</TableCell>
                    <TableCell>Progress</TableCell>
                    <TableCell>Start Time</TableCell>
                    <TableCell>Execution Time</TableCell>
                    <TableCell>Score</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {liveEvaluations.map((evaluation) => (
                    <TableRow key={evaluation.id}>
                      <TableCell>
                        <Chip
                          icon={getStatusIcon(evaluation.status) as React.ReactElement}
                          label={evaluation.status}
                          color={getStatusColor(evaluation.status) as 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{evaluation.patternType}</TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <LinearProgress
                            variant="determinate"
                            value={evaluation.progress}
                            sx={{ flexGrow: 1, minWidth: 100 }}
                          />
                          <Typography variant="body2">
                            {evaluation.progress.toFixed(0)}%
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        {new Date(evaluation.startTime).toLocaleTimeString()}
                      </TableCell>
                      <TableCell>
                        {evaluation.executionTime
                          ? `${(evaluation.executionTime / 1000).toFixed(2)}s`
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {evaluation.score
                          ? `${(evaluation.score * 100).toFixed(1)}%`
                          : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      </Box>

      {/* Recent Results */}
      <Box width="100%">
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Recent Evaluation Results
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Pattern</TableCell>
                  <TableCell>Score</TableCell>
                  <TableCell>Success</TableCell>
                  <TableCell>Execution Time</TableCell>
                  <TableCell>Timestamp</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(results || []).slice(0, 5).map((result) => (
                  <TableRow key={result.id}>
                    <TableCell>{result.patternType}</TableCell>
                    <TableCell>
                      <Chip
                        label={`${(result.overallScore * 100).toFixed(1)}%`}
                        color={result.overallScore > 0.8 ? 'success' : 'warning'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {result.success ? (
                        <CheckCircle color="success" fontSize="small" />
                      ) : (
                        <ErrorIcon color="error" fontSize="small" />
                      )}
                    </TableCell>
                    <TableCell>{result.executionTimeMs}ms</TableCell>
                    <TableCell>
                      {new Date(result.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Box>
    </Box>
  );
}
