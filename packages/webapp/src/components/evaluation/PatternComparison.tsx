import { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  Box,
  FormControl,
  FormLabel,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Select,
  MenuItem,
  type SelectChangeEvent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
} from '@mui/material';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ScatterChart,
  Scatter,
  ZAxis,
} from 'recharts';

const PATTERNS = [
  'sequential-processing',
  'routing',
  'parallel-processing',
  'orchestrator-worker',
  'evaluator-optimizer',
  'multi-step-tool-usage',
];

const PATTERN_COLORS: Record<string, string> = {
  'sequential-processing': '#8884d8',
  'routing': '#82ca9d',
  'parallel-processing': '#ffc658',
  'orchestrator-worker': '#ff7c7c',
  'evaluator-optimizer': '#8dd1e1',
  'multi-step-tool-usage': '#d084d0',
};

const METRICS = [
  'accuracy',
  'relevance',
  'completeness',
  'efficiency',
  'consistency',
  'scalability',
];

interface PatternMetrics {
  pattern: string;
  accuracy: number;
  relevance: number;
  completeness: number;
  efficiency: number;
  consistency: number;
  scalability: number;
  executionTime: number;
  successRate: number;
  evaluationCount: number;
}

export function PatternComparison() {
  const [selectedPatterns, setSelectedPatterns] = useState<string[]>(PATTERNS);
  const [comparisonMode, setComparisonMode] = useState<'radar' | 'bar' | 'scatter'>('radar');
  const [patternData, setPatternData] = useState<PatternMetrics[]>([]);

  useEffect(() => {
    // Generate sample data for demonstration
    const data = PATTERNS.map((pattern) => ({
      pattern: pattern.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      accuracy: Math.random() * 0.3 + 0.7,
      relevance: Math.random() * 0.3 + 0.7,
      completeness: Math.random() * 0.3 + 0.7,
      efficiency: Math.random() * 0.3 + 0.7,
      consistency: Math.random() * 0.3 + 0.7,
      scalability: Math.random() * 0.3 + 0.7,
      executionTime: Math.random() * 500 + 200,
      successRate: Math.random() * 0.2 + 0.8,
      evaluationCount: Math.floor(Math.random() * 1000 + 100),
    }));
    setPatternData(data);
  }, []);

  const handlePatternToggle = (pattern: string) => {
    setSelectedPatterns((prev) =>
      prev.includes(pattern)
        ? prev.filter((p) => p !== pattern)
        : [...prev, pattern]
    );
  };

  const handleModeChange = (event: SelectChangeEvent) => {
    setComparisonMode(event.target.value as 'radar' | 'bar' | 'scatter');
  };

  const filteredData = patternData.filter((d) =>
    selectedPatterns.includes(
      d.pattern.toLowerCase().replace(/ /g, '-')
    )
  );

  const radarData = METRICS.map((metric) => {
    const point: Record<string, string | number> = { metric: metric.charAt(0).toUpperCase() + metric.slice(1) };
    filteredData.forEach((pattern) => {
      point[pattern.pattern] = pattern[metric as keyof PatternMetrics] as number;
    });
    return point;
  });

  const scatterData = filteredData.map((pattern) => ({
    ...pattern,
    x: pattern.efficiency,
    y: pattern.accuracy,
    z: pattern.evaluationCount,
  }));

  const renderComparison = () => {
    switch (comparisonMode) {
      case 'radar':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="metric" />
              <PolarRadiusAxis angle={90} domain={[0, 1]} />
              {filteredData.map((pattern) => (
                <Radar
                  key={pattern.pattern}
                  name={pattern.pattern}
                  dataKey={pattern.pattern}
                  stroke={PATTERN_COLORS[pattern.pattern.toLowerCase().replace(/ /g, '-')]}
                  fill={PATTERN_COLORS[pattern.pattern.toLowerCase().replace(/ /g, '-')]}
                  fillOpacity={0.3}
                />
              ))}
              <Legend />
            </RadarChart>
          </ResponsiveContainer>
        );

      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={filteredData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="pattern" angle={-45} textAnchor="end" height={100} />
              <YAxis domain={[0, 1]} />
              <Tooltip />
              <Legend />
              {METRICS.map((metric, index) => (
                <Bar
                  key={metric}
                  dataKey={metric}
                  fill={Object.values(PATTERN_COLORS)[index]}
                  name={metric.charAt(0).toUpperCase() + metric.slice(1)}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );

      case 'scatter':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" dataKey="x" name="Efficiency" domain={[0, 1]} />
              <YAxis type="number" dataKey="y" name="Accuracy" domain={[0, 1]} />
              <ZAxis type="number" dataKey="z" range={[50, 400]} name="Evaluation Count" />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} />
              <Legend />
              {filteredData.map((pattern) => (
                <Scatter
                  key={pattern.pattern}
                  name={pattern.pattern}
                  data={[scatterData.find((d) => d.pattern === pattern.pattern)!]}
                  fill={PATTERN_COLORS[pattern.pattern.toLowerCase().replace(/ /g, '-')]}
                />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        );
    }
  };

  return (
    <Box display="flex" flexWrap="wrap" gap={3}>
      {/* Controls */}
      <Box flex={{ xs: '0 0 100%', md: '0 0 calc(25% - 18px)' }}>
        <Paper sx={{ p: 2 }}>
          <FormControl component="fieldset">
            <FormLabel component="legend">Select Patterns</FormLabel>
            <FormGroup>
              {PATTERNS.map((pattern) => (
                <FormControlLabel
                  key={pattern}
                  control={
                    <Checkbox
                      checked={selectedPatterns.includes(pattern)}
                      onChange={() => handlePatternToggle(pattern)}
                      name={pattern}
                      sx={{
                        color: PATTERN_COLORS[pattern],
                        '&.Mui-checked': {
                          color: PATTERN_COLORS[pattern],
                        },
                      }}
                    />
                  }
                  label={pattern.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                />
              ))}
            </FormGroup>
          </FormControl>

          <FormControl fullWidth sx={{ mt: 3 }}>
            <FormLabel>Comparison Mode</FormLabel>
            <Select value={comparisonMode} onChange={handleModeChange} size="small">
              <MenuItem value="radar">Radar Chart</MenuItem>
              <MenuItem value="bar">Bar Chart</MenuItem>
              <MenuItem value="scatter">Scatter Plot</MenuItem>
            </Select>
          </FormControl>
        </Paper>
      </Box>

      {/* Visualization */}
      <Box flex={{ xs: '0 0 100%', md: '0 0 calc(75% - 12px)' }}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Pattern Performance Comparison
          </Typography>
          {renderComparison()}
        </Paper>
      </Box>

      {/* Detailed Metrics Table */}
      <Box width="100%">
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Detailed Metrics Comparison
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Pattern</TableCell>
                  <TableCell align="center">Accuracy</TableCell>
                  <TableCell align="center">Relevance</TableCell>
                  <TableCell align="center">Completeness</TableCell>
                  <TableCell align="center">Efficiency</TableCell>
                  <TableCell align="center">Consistency</TableCell>
                  <TableCell align="center">Scalability</TableCell>
                  <TableCell align="center">Success Rate</TableCell>
                  <TableCell align="center">Avg Execution Time</TableCell>
                  <TableCell align="center">Total Evaluations</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredData.map((pattern) => (
                  <TableRow key={pattern.pattern}>
                    <TableCell>
                      <Chip
                        label={pattern.pattern}
                        size="small"
                        sx={{
                          backgroundColor: PATTERN_COLORS[pattern.pattern.toLowerCase().replace(/ /g, '-')],
                          color: 'white',
                        }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      {(pattern.accuracy * 100).toFixed(1)}%
                    </TableCell>
                    <TableCell align="center">
                      {(pattern.relevance * 100).toFixed(1)}%
                    </TableCell>
                    <TableCell align="center">
                      {(pattern.completeness * 100).toFixed(1)}%
                    </TableCell>
                    <TableCell align="center">
                      {(pattern.efficiency * 100).toFixed(1)}%
                    </TableCell>
                    <TableCell align="center">
                      {(pattern.consistency * 100).toFixed(1)}%
                    </TableCell>
                    <TableCell align="center">
                      {(pattern.scalability * 100).toFixed(1)}%
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={`${(pattern.successRate * 100).toFixed(1)}%`}
                        color={pattern.successRate > 0.9 ? 'success' : 'warning'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      {pattern.executionTime.toFixed(0)}ms
                    </TableCell>
                    <TableCell align="center">
                      {pattern.evaluationCount.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Box>

      {/* Key Insights */}
      <Box width="100%">
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Key Insights
          </Typography>
          {filteredData.length > 0 ? (
            <Box display="flex" flexWrap="wrap" gap={2}>
              <Box flex={{ xs: '0 0 100%', md: '0 0 calc(33.333% - 16px)' }}>
                <Box>
                  <Typography variant="subtitle2" color="textSecondary">
                    Best Overall Performance
                  </Typography>
                  <Typography variant="h6">
                    {filteredData.reduce((best, current) => {
                      const currentScore =
                        (current.accuracy + current.relevance + current.completeness +
                         current.efficiency + current.consistency + current.scalability) / 6;
                      const bestScore =
                        (best.accuracy + best.relevance + best.completeness +
                         best.efficiency + best.consistency + best.scalability) / 6;
                      return currentScore > bestScore ? current : best;
                    }).pattern}
                  </Typography>
                </Box>
              </Box>
              <Box flex={{ xs: '0 0 100%', md: '0 0 calc(33.333% - 16px)' }}>
                <Box>
                  <Typography variant="subtitle2" color="textSecondary">
                    Most Efficient Pattern
                  </Typography>
                  <Typography variant="h6">
                    {filteredData.reduce((best, current) =>
                      current.executionTime < best.executionTime ? current : best
                    ).pattern}
                  </Typography>
                </Box>
              </Box>
              <Box flex={{ xs: '0 0 100%', md: '0 0 calc(33.333% - 16px)' }}>
                <Box>
                  <Typography variant="subtitle2" color="textSecondary">
                    Highest Success Rate
                  </Typography>
                  <Typography variant="h6">
                    {filteredData.reduce((best, current) =>
                      current.successRate > best.successRate ? current : best
                    ).pattern}
                  </Typography>
                </Box>
              </Box>
            </Box>
          ) : (
            <Typography color="textSecondary">
              Select at least one pattern to view insights.
            </Typography>
          )}
        </Paper>
      </Box>
    </Box>
  );
}
