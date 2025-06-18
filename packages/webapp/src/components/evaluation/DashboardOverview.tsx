import {
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  LinearProgress,
  Chip,
  List,
  ListItem,
  ListItemText,
  useTheme,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  CheckCircle,
  Warning,
  Error as ErrorIcon,
} from '@mui/icons-material';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import type { DashboardSummary } from '../../hooks/useEvaluationData';

interface DashboardOverviewProps {
  data: DashboardSummary | null;
}

const PATTERN_COLORS = {
  'sequential-processing': '#8884d8',
  'routing': '#82ca9d',
  'parallel-processing': '#ffc658',
  'orchestrator-worker': '#ff7c7c',
  'evaluator-optimizer': '#8dd1e1',
  'multi-step-tool-usage': '#d084d0',
};

export function DashboardOverview({ data }: DashboardOverviewProps) {
  const theme = useTheme();

  if (!data) {
    return <Typography>Loading dashboard data...</Typography>;
  }

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle color="success" />;
      case 'degraded':
        return <Warning color="warning" />;
      case 'critical':
        return <ErrorIcon color="error" />;
      default:
        return null;
    }
  };

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return theme.palette.success.main;
      case 'degraded':
        return theme.palette.warning.main;
      case 'critical':
        return theme.palette.error.main;
      default:
        return theme.palette.grey[500];
    }
  };

  // Prepare data for pie chart with safety checks
  const pieData = (data.patternPerformance || []).map((pattern) => ({
    name: pattern.pattern.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
    value: pattern.evaluationCount,
  }));

  // Prepare data for bar chart with safety checks
  const barData = (data.patternPerformance || []).map((pattern) => ({
    pattern: pattern.pattern.split('-').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' '),
    score: pattern.averageScore,
    successRate: pattern.successRate,
  }));

  return (
    <Box display="flex" flexWrap="wrap" gap={3}>
      {/* Key Metrics Cards */}
      <Box flex={{ xs: '0 0 100%', md: '0 0 calc(25% - 18px)' }}>
        <Card>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              Total Evaluations
            </Typography>
            <Typography variant="h4" component="div">
              {data.totalEvaluations.toLocaleString()}
            </Typography>
          </CardContent>
        </Card>
      </Box>

      <Box flex={{ xs: '0 0 100%', md: '0 0 calc(25% - 18px)' }}>
        <Card>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              Average Score
            </Typography>
            <Typography variant="h4" component="div">
              {(data.averageScore * 100).toFixed(1)}%
            </Typography>
            <LinearProgress
              variant="determinate"
              value={data.averageScore * 100}
              sx={{ mt: 1 }}
            />
          </CardContent>
        </Card>
      </Box>

      <Box flex={{ xs: '0 0 100%', md: '0 0 calc(25% - 18px)' }}>
        <Card>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              Success Rate
            </Typography>
            <Typography variant="h4" component="div">
              {(data.successRate * 100).toFixed(1)}%
            </Typography>
            <Box display="flex" alignItems="center" mt={1}>
              {data.successRate > 0.8 ? (
                <TrendingUp color="success" />
              ) : (
                <TrendingDown color="error" />
              )}
              <Typography
                variant="body2"
                color={data.successRate > 0.8 ? 'success.main' : 'error.main'}
                sx={{ ml: 1 }}
              >
                {data.successRate > 0.8 ? 'Good' : 'Needs Improvement'}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>

      <Box flex={{ xs: '0 0 100%', md: '0 0 calc(25% - 18px)' }}>
        <Card>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              System Health
            </Typography>
            <Box display="flex" alignItems="center" gap={1}>
              {getHealthIcon(data.systemHealth.status)}
              <Typography
                variant="h5"
                component="div"
                color={getHealthColor(data.systemHealth.status)}
              >
                {data.systemHealth.status.toUpperCase()}
              </Typography>
            </Box>
            {data.systemHealth.issues.length > 0 && (
              <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                {data.systemHealth.issues.length} issue(s)
              </Typography>
            )}
          </CardContent>
        </Card>
      </Box>

      {/* Pattern Distribution */}
      <Box flex={{ xs: '0 0 100%', md: '0 0 calc(50% - 12px)' }}>
        <Paper sx={{ p: 2, height: '100%' }}>
          <Typography variant="h6" gutterBottom>
            Evaluation Distribution by Pattern
          </Typography>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => `${entry.name}: ${entry.value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((_entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={Object.values(PATTERN_COLORS)[index % Object.values(PATTERN_COLORS).length]}
                  />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Paper>
      </Box>

      {/* Pattern Performance */}
      <Box flex={{ xs: '0 0 100%', md: '0 0 calc(50% - 12px)' }}>
        <Paper sx={{ p: 2, height: '100%' }}>
          <Typography variant="h6" gutterBottom>
            Pattern Performance Comparison
          </Typography>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="pattern" angle={-45} textAnchor="end" height={80} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="score" fill="#8884d8" name="Avg Score" />
              <Bar dataKey="successRate" fill="#82ca9d" name="Success Rate" />
            </BarChart>
          </ResponsiveContainer>
        </Paper>
      </Box>

      {/* Top Metrics */}
      <Box flex={{ xs: '0 0 100%', md: '0 0 calc(50% - 12px)' }}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Top Performing Metrics
          </Typography>
          <List>
            {(data.topMetrics || []).slice(0, 5).map((metric, index) => (
              <ListItem key={index}>
                <ListItemText
                  primary={metric.name}
                  secondary={
                    <LinearProgress
                      variant="determinate"
                      value={metric.averageScore * 100}
                      sx={{ mt: 1 }}
                    />
                  }
                />
                <Typography variant="body2" sx={{ ml: 2 }}>
                  {(metric.averageScore * 100).toFixed(1)}%
                </Typography>
              </ListItem>
            ))}
          </List>
        </Paper>
      </Box>

      {/* Recent Failures */}
      <Box flex={{ xs: '0 0 100%', md: '0 0 calc(50% - 12px)' }}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Recent Failures
          </Typography>
          <List>
            {(data.recentFailures || []).slice(0, 5).map((failure) => (
              <ListItem key={failure.id}>
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Chip
                        label={failure.patternType}
                        size="small"
                        color="error"
                        variant="outlined"
                      />
                      <Typography variant="body2">
                        {new Date(failure.timestamp).toLocaleString()}
                      </Typography>
                    </Box>
                  }
                  secondary={failure.error}
                />
              </ListItem>
            ))}
            {data.recentFailures.length === 0 && (
              <Typography variant="body2" color="textSecondary">
                No recent failures
              </Typography>
            )}
          </List>
        </Paper>
      </Box>
    </Box>
  );
}
