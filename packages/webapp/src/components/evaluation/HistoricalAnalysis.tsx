import { useState } from 'react';
import {
  Paper,
  Typography,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  type SelectChangeEvent,
  ToggleButton,
  ToggleButtonGroup,
  Button,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Brush,
  ReferenceLine,
} from 'recharts';
import { Download } from '@mui/icons-material';
import { useTimeSeriesData } from '../../hooks/useEvaluationData';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

const PATTERNS = [
  { value: 'all', label: 'All Patterns' },
  { value: 'sequential-processing', label: 'Sequential Processing' },
  { value: 'routing', label: 'Routing' },
  { value: 'parallel-processing', label: 'Parallel Processing' },
  { value: 'orchestrator-worker', label: 'Orchestrator-Worker' },
  { value: 'evaluator-optimizer', label: 'Evaluator-Optimizer' },
  { value: 'multi-step-tool-usage', label: 'Multi-Step Tool Usage' },
];

const METRICS = [
  { value: 'overallScore', label: 'Overall Score' },
  { value: 'accuracy', label: 'Accuracy' },
  { value: 'relevance', label: 'Relevance' },
  { value: 'completeness', label: 'Completeness' },
  { value: 'efficiency', label: 'Efficiency' },
  { value: 'executionTime', label: 'Execution Time' },
  { value: 'successRate', label: 'Success Rate' },
];

export function HistoricalAnalysis() {
  const [selectedPattern, setSelectedPattern] = useState('all');
  const [selectedMetric, setSelectedMetric] = useState('overallScore');
  const [dateRange, setDateRange] = useState({
    start: startOfDay(subDays(new Date(), 7)),
    end: endOfDay(new Date()),
  });
  const [interval, setInterval] = useState<'hour' | 'day' | 'week'>('day');
  const [chartType, setChartType] = useState<'line' | 'area' | 'bar'>('line');

  const { data, loading } = useTimeSeriesData({
    patternType: selectedPattern === 'all' ? 'sequential-processing' : selectedPattern,
    startDate: dateRange.start,
    endDate: dateRange.end,
    interval,
    metric: selectedMetric,
  });

  const handlePatternChange = (event: SelectChangeEvent) => {
    setSelectedPattern(event.target.value);
  };

  const handleMetricChange = (event: SelectChangeEvent) => {
    setSelectedMetric(event.target.value);
  };

  const handleIntervalChange = (_: React.MouseEvent<HTMLElement>, newInterval: string | null) => {
    if (newInterval) {
      setInterval(newInterval as 'hour' | 'day' | 'week');
    }
  };

  const handleChartTypeChange = (_: React.MouseEvent<HTMLElement>, newType: string | null) => {
    if (newType) {
      setChartType(newType as 'line' | 'area' | 'bar');
    }
  };

  const exportData = () => {
    const csvContent = [
      ['Date', 'Value', 'Pattern', 'Metric'],
      ...data.map((item) => [
        item.date,
        item.value,
        selectedPattern,
        selectedMetric,
      ]),
    ]
      .map((row) => row.join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `evaluation-data-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Generate sample data if no data available
  const chartData: Array<{ date: string; value: number; baseline: number }> = data.length > 0
    ? data.map(d => ({ ...d, baseline: d.baseline || 0.8 }))
    : Array.from({ length: 30 }, (_, i) => ({
        date: format(subDays(new Date(), 30 - i), 'yyyy-MM-dd'),
        value: Math.random() * 0.3 + 0.7,
        baseline: 0.8,
      }));

  const renderChart = () => {
    const commonProps = {
      width: '100%' as const,
      height: 400,
      data: chartData,
      margin: { top: 5, right: 30, left: 20, bottom: 5 },
    };

    switch (chartType) {
      case 'line':
        return (
          <ResponsiveContainer {...commonProps}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis domain={selectedMetric === 'executionTime' ? undefined : [0, 1]} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#8884d8"
                name={METRICS.find((m) => m.value === selectedMetric)?.label}
              />
              {selectedMetric !== 'executionTime' && (
                <ReferenceLine y={0.8} label="Target" stroke="red" strokeDasharray="3 3" />
              )}
              <Brush dataKey="date" height={30} stroke="#8884d8" />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer {...commonProps}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis domain={selectedMetric === 'executionTime' ? undefined : [0, 1]} />
              <Tooltip />
              <Legend />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#8884d8"
                fill="#8884d8"
                fillOpacity={0.6}
                name={METRICS.find((m) => m.value === selectedMetric)?.label}
              />
              {selectedMetric !== 'executionTime' && (
                <ReferenceLine y={0.8} label="Target" stroke="red" strokeDasharray="3 3" />
              )}
              <Brush dataKey="date" height={30} stroke="#8884d8" />
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'bar':
        return (
          <ResponsiveContainer {...commonProps}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis domain={selectedMetric === 'executionTime' ? undefined : [0, 1]} />
              <Tooltip />
              <Legend />
              <Bar
                dataKey="value"
                fill="#8884d8"
                name={METRICS.find((m) => m.value === selectedMetric)?.label}
              />
              {selectedMetric !== 'executionTime' && (
                <ReferenceLine y={0.8} label="Target" stroke="red" strokeDasharray="3 3" />
              )}
              <Brush dataKey="date" height={30} stroke="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        );
    }
  };

  return (
    <Box display="flex" flexWrap="wrap" gap={3}>
      {/* Controls */}
      <Box width="100%">
        <Paper sx={{ p: 3 }}>
          <Box display="flex" flexWrap="wrap" gap={2} alignItems="center">
            <Box flex={{ xs: '0 0 100%', sm: '0 0 calc(50% - 8px)', md: '0 0 calc(16.666% - 13.33px)' }}>
              <FormControl fullWidth size="small">
                <InputLabel>Pattern</InputLabel>
                <Select value={selectedPattern} onChange={handlePatternChange} label="Pattern">
                  {PATTERNS.map((pattern) => (
                    <MenuItem key={pattern.value} value={pattern.value}>
                      {pattern.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <Box flex={{ xs: '0 0 100%', sm: '0 0 calc(50% - 8px)', md: '0 0 calc(16.666% - 13.33px)' }}>
              <FormControl fullWidth size="small">
                <InputLabel>Metric</InputLabel>
                <Select value={selectedMetric} onChange={handleMetricChange} label="Metric">
                  {METRICS.map((metric) => (
                    <MenuItem key={metric.value} value={metric.value}>
                      {metric.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <Box flex={{ xs: '0 0 100%', sm: '0 0 calc(50% - 8px)', md: '0 0 calc(16.666% - 13.33px)' }}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="Start Date"
                  value={dateRange.start}
                  onChange={(newValue) =>
                    newValue && setDateRange((prev) => ({ ...prev, start: newValue }))
                  }
                  slotProps={{ textField: { size: 'small', fullWidth: true } }}
                />
              </LocalizationProvider>
            </Box>

            <Box flex={{ xs: '0 0 100%', sm: '0 0 calc(50% - 8px)', md: '0 0 calc(16.666% - 13.33px)' }}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="End Date"
                  value={dateRange.end}
                  onChange={(newValue) =>
                    newValue && setDateRange((prev) => ({ ...prev, end: newValue }))
                  }
                  slotProps={{ textField: { size: 'small', fullWidth: true } }}
                />
              </LocalizationProvider>
            </Box>

            <Box flex={{ xs: '0 0 100%', sm: '0 0 calc(50% - 8px)', md: '0 0 calc(16.666% - 13.33px)' }}>
              <ToggleButtonGroup
                value={interval}
                exclusive
                onChange={handleIntervalChange}
                size="small"
                fullWidth
              >
                <ToggleButton value="hour">Hour</ToggleButton>
                <ToggleButton value="day">Day</ToggleButton>
                <ToggleButton value="week">Week</ToggleButton>
              </ToggleButtonGroup>
            </Box>

            <Box flex={{ xs: '0 0 100%', sm: '0 0 calc(50% - 8px)', md: '0 0 calc(16.666% - 13.33px)' }}>
              <Button
                variant="contained"
                startIcon={<Download />}
                onClick={exportData}
                fullWidth
                size="small"
              >
                Export CSV
              </Button>
            </Box>
          </Box>
        </Paper>
      </Box>

      {/* Chart Type Selector */}
      <Box width="100%">
        <Box display="flex" justifyContent="center">
          <ToggleButtonGroup
            value={chartType}
            exclusive
            onChange={handleChartTypeChange}
            size="small"
          >
            <ToggleButton value="line">Line Chart</ToggleButton>
            <ToggleButton value="area">Area Chart</ToggleButton>
            <ToggleButton value="bar">Bar Chart</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>

      {/* Main Chart */}
      <Box width="100%">
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            {METRICS.find((m) => m.value === selectedMetric)?.label} Over Time
          </Typography>
          {loading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <Typography>Loading chart data...</Typography>
            </Box>
          ) : (
            renderChart()
          )}
        </Paper>
      </Box>

      {/* Statistics */}
      <Box flex={{ xs: '0 0 100%', md: '0 0 calc(33.333% - 16px)' }}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle1" gutterBottom>
            Average
          </Typography>
          <Typography variant="h4">
            {chartData.length > 0
              ? (
                  chartData.reduce((sum, item) => sum + item.value, 0) /
                  chartData.length
                ).toFixed(3)
              : 'N/A'}
          </Typography>
        </Paper>
      </Box>

      <Box flex={{ xs: '0 0 100%', md: '0 0 calc(33.333% - 16px)' }}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle1" gutterBottom>
            Min / Max
          </Typography>
          <Typography variant="h4">
            {chartData.length > 0
              ? `${Math.min(...chartData.map((d) => d.value)).toFixed(3)} / ${Math.max(
                  ...chartData.map((d) => d.value)
                ).toFixed(3)}`
              : 'N/A'}
          </Typography>
        </Paper>
      </Box>

      <Box flex={{ xs: '0 0 100%', md: '0 0 calc(33.333% - 16px)' }}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle1" gutterBottom>
            Trend
          </Typography>
          <Typography variant="h4">
            {chartData.length > 1
              ? chartData[chartData.length - 1].value > chartData[0].value
                ? '↑ Improving'
                : '↓ Declining'
              : 'N/A'}
          </Typography>
        </Paper>
      </Box>
    </Box>
  );
}