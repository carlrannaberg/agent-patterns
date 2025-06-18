import { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Collapse,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  type SelectChangeEvent,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import {
  KeyboardArrowDown,
  KeyboardArrowUp,
  Error as ErrorIcon,
  Warning,
  Info,
  Search,
  TrendingUp,
  BugReport,
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
  Treemap,
} from 'recharts';

interface FailurePattern {
  id: string;
  patternType: string;
  errorType: string;
  errorMessage: string;
  frequency: number;
  impact: 'high' | 'medium' | 'low';
  firstSeen: string;
  lastSeen: string;
  affectedTestCases: string[];
  suggestedFix?: string;
  rootCause?: string;
}

interface FailureDetails {
  id: string;
  timestamp: string;
  input: unknown;
  output: unknown;
  expectedBehavior: string;
  actualBehavior: string;
  stackTrace?: string;
}

const ERROR_TYPES = [
  { value: 'all', label: 'All Error Types' },
  { value: 'timeout', label: 'Timeout' },
  { value: 'validation', label: 'Validation Error' },
  { value: 'api', label: 'API Error' },
  { value: 'processing', label: 'Processing Error' },
  { value: 'memory', label: 'Memory Error' },
  { value: 'unknown', label: 'Unknown' },
];

const IMPACT_COLORS = {
  high: '#f44336',
  medium: '#ff9800',
  low: '#ffc107',
};

function FailureRow({ failure, details }: { failure: FailurePattern; details?: FailureDetails }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <TableRow sx={{ '& > *': { borderBottom: 'unset' } }}>
        <TableCell>
          <IconButton size="small" onClick={() => setOpen(!open)}>
            {open ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
          </IconButton>
        </TableCell>
        <TableCell>{failure.patternType}</TableCell>
        <TableCell>{failure.errorType}</TableCell>
        <TableCell>
          <Typography variant="body2" sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {failure.errorMessage}
          </Typography>
        </TableCell>
        <TableCell align="center">{failure.frequency}</TableCell>
        <TableCell>
          <Chip
            label={failure.impact}
            size="small"
            sx={{
              backgroundColor: IMPACT_COLORS[failure.impact],
              color: 'white',
            }}
          />
        </TableCell>
        <TableCell>{new Date(failure.lastSeen).toLocaleString()}</TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={7}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 2 }}>
              <Box display="flex" flexWrap="wrap" gap={2}>
                <Box flex={{ xs: '0 0 100%', md: '0 0 calc(50% - 8px)' }}>
                  <Typography variant="h6" gutterBottom>
                    Failure Details
                  </Typography>
                  <List dense>
                    <ListItem>
                      <ListItemText
                        primary="First Occurrence"
                        secondary={new Date(failure.firstSeen).toLocaleString()}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="Affected Test Cases"
                        secondary={failure.affectedTestCases.join(', ')}
                      />
                    </ListItem>
                    {failure.rootCause && (
                      <ListItem>
                        <ListItemText primary="Root Cause" secondary={failure.rootCause} />
                      </ListItem>
                    )}
                  </List>
                </Box>
                <Box flex={{ xs: '0 0 100%', md: '0 0 calc(50% - 8px)' }}>
                  {failure.suggestedFix && (
                    <Alert severity="info" icon={<TrendingUp />}>
                      <Typography variant="subtitle2">Suggested Fix:</Typography>
                      <Typography variant="body2">{failure.suggestedFix}</Typography>
                    </Alert>
                  )}
                  {details?.stackTrace && (
                    <Box mt={2}>
                      <Typography variant="subtitle2">Stack Trace:</Typography>
                      <TextField
                        multiline
                        rows={4}
                        fullWidth
                        value={details.stackTrace}
                        variant="outlined"
                        size="small"
                        InputProps={{ readOnly: true }}
                        sx={{ fontFamily: 'monospace', fontSize: 12 }}
                      />
                    </Box>
                  )}
                </Box>
              </Box>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

export function FailureAnalysis() {
  const [failures, setFailures] = useState<FailurePattern[]>([]);
  const [selectedErrorType, setSelectedErrorType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Generate sample failure data
    const sampleFailures: FailurePattern[] = [
      {
        id: '1',
        patternType: 'sequential-processing',
        errorType: 'timeout',
        errorMessage: 'Operation timed out after 30000ms',
        frequency: 15,
        impact: 'high',
        firstSeen: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        lastSeen: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        affectedTestCases: ['test-case-1', 'test-case-3'],
        suggestedFix: 'Increase timeout threshold or optimize processing logic',
        rootCause: 'Large input data causing processing delays',
      },
      {
        id: '2',
        patternType: 'routing',
        errorType: 'validation',
        errorMessage: 'Invalid input format: missing required field "category"',
        frequency: 8,
        impact: 'medium',
        firstSeen: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        lastSeen: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        affectedTestCases: ['test-case-5'],
        suggestedFix: 'Add input validation for required fields',
      },
      {
        id: '3',
        patternType: 'parallel-processing',
        errorType: 'memory',
        errorMessage: 'Memory limit exceeded during parallel execution',
        frequency: 3,
        impact: 'high',
        firstSeen: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        lastSeen: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        affectedTestCases: ['test-case-7', 'test-case-8'],
        suggestedFix: 'Implement memory pooling or reduce parallelism',
        rootCause: 'Too many concurrent operations',
      },
    ];

    setTimeout(() => {
      setFailures(sampleFailures);
      setLoading(false);
    }, 1000);
  }, []);

  const handleErrorTypeChange = (event: SelectChangeEvent) => {
    setSelectedErrorType(event.target.value);
  };

  const filteredFailures = failures.filter((failure) => {
    const matchesType = selectedErrorType === 'all' || failure.errorType === selectedErrorType;
    const matchesSearch =
      searchTerm === '' ||
      failure.errorMessage.toLowerCase().includes(searchTerm.toLowerCase()) ||
      failure.patternType.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesType && matchesSearch;
  });

  // Prepare data for visualizations
  const errorTypeDistribution = Object.entries(
    failures.reduce((acc, failure) => {
      acc[failure.errorType] = (acc[failure.errorType] || 0) + failure.frequency;
      return acc;
    }, {} as Record<string, number>)
  ).map(([type, count]) => ({ name: type, value: count }));

  const patternFailureData = Object.entries(
    failures.reduce((acc, failure) => {
      acc[failure.patternType] = (acc[failure.patternType] || 0) + failure.frequency;
      return acc;
    }, {} as Record<string, number>)
  ).map(([pattern, count]) => ({ pattern, failures: count }));

  const impactDistribution = Object.entries(
    failures.reduce((acc, failure) => {
      acc[failure.impact] = (acc[failure.impact] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([impact, count]) => ({ name: impact, value: count, fill: IMPACT_COLORS[impact as keyof typeof IMPACT_COLORS] }));

  // Treemap data for error hierarchy
  const treemapData = {
    name: 'Failures',
    children: Object.entries(
      failures.reduce((acc, failure) => {
        if (!acc[failure.patternType]) {
          acc[failure.patternType] = [];
        }
        acc[failure.patternType].push({
          name: failure.errorType,
          size: failure.frequency,
          impact: failure.impact,
        });
        return acc;
      }, {} as Record<string, Array<{ name: string; size: number; impact: string }>>)
    ).map(([pattern, errors]) => ({
      name: pattern,
      children: errors,
    })),
  };

  return (
    <Box display="flex" flexWrap="wrap" gap={3}>
      {/* Search and Filters */}
      <Box width="100%">
        <Paper sx={{ p: 2 }}>
          <Box display="flex" flexWrap="wrap" gap={2} alignItems="center">
            <Box flex={{ xs: '0 0 100%', md: '0 0 calc(50% - 8px)' }}>
              <TextField
                fullWidth
                variant="outlined"
                size="small"
                placeholder="Search failures..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />,
                }}
              />
            </Box>
            <Box flex={{ xs: '0 0 100%', md: '0 0 calc(25% - 12px)' }}>
              <FormControl fullWidth size="small">
                <InputLabel>Error Type</InputLabel>
                <Select value={selectedErrorType} onChange={handleErrorTypeChange} label="Error Type">
                  {ERROR_TYPES.map((type) => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <Box flex={{ xs: '0 0 100%', md: '0 0 calc(25% - 12px)' }}>
              <Button
                variant="outlined"
                startIcon={<BugReport />}
                fullWidth
              >
                Generate Report
              </Button>
            </Box>
          </Box>
        </Paper>
      </Box>

      {/* Visualizations */}
      <Box flex={{ xs: '0 0 100%', md: '0 0 calc(33.333% - 16px)' }}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Error Type Distribution
          </Typography>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={errorTypeDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => `${entry.name}: ${entry.value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {errorTypeDistribution.map((_entry, index) => (
                  <Cell key={`cell-${index}`} fill={`hsl(${index * 45}, 70%, 50%)`} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Paper>
      </Box>

      <Box flex={{ xs: '0 0 100%', md: '0 0 calc(33.333% - 16px)' }}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Failures by Pattern
          </Typography>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={patternFailureData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="pattern" angle={-45} textAnchor="end" height={80} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="failures" fill="#82ca9d" />
            </BarChart>
          </ResponsiveContainer>
        </Paper>
      </Box>

      <Box flex={{ xs: '0 0 100%', md: '0 0 calc(33.333% - 16px)' }}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Impact Severity
          </Typography>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={impactDistribution}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {impactDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Paper>
      </Box>

      {/* Failure Hierarchy */}
      <Box width="100%">
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Failure Hierarchy
          </Typography>
          <ResponsiveContainer width="100%" height={300}>
            <Treemap
              data={treemapData.children}
              dataKey="size"
              aspectRatio={4 / 3}
              stroke="#fff"
              fill="#8884d8"
            />
          </ResponsiveContainer>
        </Paper>
      </Box>

      {/* Failure Table */}
      <Box width="100%">
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Failure Patterns ({filteredFailures.length})
          </Typography>
          {loading ? (
            <Typography>Loading failure data...</Typography>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell />
                    <TableCell>Pattern</TableCell>
                    <TableCell>Error Type</TableCell>
                    <TableCell>Error Message</TableCell>
                    <TableCell align="center">Frequency</TableCell>
                    <TableCell>Impact</TableCell>
                    <TableCell>Last Seen</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredFailures.map((failure) => (
                    <FailureRow key={failure.id} failure={failure} />
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      </Box>

      {/* Optimization Opportunities */}
      <Box width="100%">
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Optimization Opportunities
          </Typography>
          <List>
            <ListItem>
              <ListItemIcon>
                <Warning color="warning" />
              </ListItemIcon>
              <ListItemText
                primary="High-frequency timeout errors in sequential-processing"
                secondary="Consider implementing adaptive timeout based on input size"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <Info color="info" />
              </ListItemIcon>
              <ListItemText
                primary="Validation errors could be prevented with input preprocessing"
                secondary="Add schema validation before processing"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <ErrorIcon color="error" />
              </ListItemIcon>
              <ListItemText
                primary="Memory issues in parallel-processing pattern"
                secondary="Implement resource pooling and batch size optimization"
              />
            </ListItem>
          </List>
        </Paper>
      </Box>
    </Box>
  );
}