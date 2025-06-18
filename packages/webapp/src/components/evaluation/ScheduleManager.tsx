import { useState } from 'react';
import {
  Paper,
  Typography,
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  type SelectChangeEvent,
  Chip,
  Switch,
  FormControlLabel,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  PlayArrow,
  Schedule,
  History,
  Notifications,
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, addDays, isPast } from 'date-fns';

interface EvaluationSchedule {
  id: string;
  name: string;
  pattern: string;
  frequency: 'once' | 'hourly' | 'daily' | 'weekly' | 'monthly';
  nextRun: Date;
  lastRun?: Date;
  enabled: boolean;
  testCases: string[];
  notificationEmail?: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
}

interface ScheduleRun {
  id: string;
  scheduleId: string;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'completed' | 'failed';
  evaluationCount: number;
  averageScore?: number;
  errors?: string[];
}

const PATTERNS = [
  'all',
  'sequential-processing',
  'routing',
  'parallel-processing',
  'orchestrator-worker',
  'evaluator-optimizer',
  'multi-step-tool-usage',
];

export function ScheduleManager() {
  const [schedules, setSchedules] = useState<EvaluationSchedule[]>([
    {
      id: '1',
      name: 'Daily Pattern Evaluation',
      pattern: 'all',
      frequency: 'daily',
      nextRun: addDays(new Date(), 1),
      lastRun: new Date(),
      enabled: true,
      testCases: ['test-suite-1', 'test-suite-2'],
      status: 'idle',
    },
    {
      id: '2',
      name: 'Sequential Processing Weekly Check',
      pattern: 'sequential-processing',
      frequency: 'weekly',
      nextRun: addDays(new Date(), 7),
      enabled: false,
      testCases: ['sequential-tests'],
      status: 'idle',
    },
  ]);

  const [scheduleRuns, setScheduleRuns] = useState<ScheduleRun[]>([
    {
      id: '1',
      scheduleId: '1',
      startTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
      endTime: new Date(Date.now() - 23 * 60 * 60 * 1000),
      status: 'completed',
      evaluationCount: 150,
      averageScore: 0.87,
    },
  ]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<EvaluationSchedule | null>(null);
  const [formData, setFormData] = useState<Partial<EvaluationSchedule>>({
    name: '',
    pattern: 'all',
    frequency: 'daily',
    nextRun: new Date(),
    enabled: true,
    testCases: [],
  });

  const handleCreateSchedule = () => {
    setEditingSchedule(null);
    setFormData({
      name: '',
      pattern: 'all',
      frequency: 'daily',
      nextRun: new Date(),
      enabled: true,
      testCases: [],
    });
    setDialogOpen(true);
  };

  const handleEditSchedule = (schedule: EvaluationSchedule) => {
    setEditingSchedule(schedule);
    setFormData(schedule);
    setDialogOpen(true);
  };

  const handleDeleteSchedule = (id: string) => {
    setSchedules((prev) => prev.filter((s) => s.id !== id));
  };

  const handleSaveSchedule = () => {
    if (editingSchedule) {
      setSchedules((prev) =>
        prev.map((s) => (s.id === editingSchedule.id ? { ...s, ...formData } as EvaluationSchedule : s))
      );
    } else {
      const newSchedule: EvaluationSchedule = {
        id: Date.now().toString(),
        ...formData,
        status: 'idle',
      } as EvaluationSchedule;
      setSchedules((prev) => [...prev, newSchedule]);
    }
    setDialogOpen(false);
  };

  const handleToggleSchedule = (id: string) => {
    setSchedules((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
  };

  const handleRunNow = (schedule: EvaluationSchedule) => {
    // Simulate running the schedule
    setSchedules((prev) =>
      prev.map((s) => (s.id === schedule.id ? { ...s, status: 'running' } : s))
    );

    const newRun: ScheduleRun = {
      id: Date.now().toString(),
      scheduleId: schedule.id,
      startTime: new Date(),
      status: 'running',
      evaluationCount: 0,
    };
    setScheduleRuns((prev) => [newRun, ...prev]);

    // Simulate completion after 3 seconds
    setTimeout(() => {
      setSchedules((prev) =>
        prev.map((s) =>
          s.id === schedule.id
            ? { ...s, status: 'completed', lastRun: new Date() }
            : s
        )
      );
      setScheduleRuns((prev) =>
        prev.map((r) =>
          r.id === newRun.id
            ? {
                ...r,
                status: 'completed',
                endTime: new Date(),
                evaluationCount: Math.floor(Math.random() * 100 + 50),
                averageScore: Math.random() * 0.2 + 0.75,
              }
            : r
        )
      );
    }, 3000);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'idle':
        return 'default';
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

  const getNextRunText = (schedule: EvaluationSchedule) => {
    if (!schedule.enabled) return 'Disabled';
    if (schedule.status === 'running') return 'Running now...';
    if (isPast(schedule.nextRun)) return 'Overdue';
    return format(schedule.nextRun, 'MMM dd, yyyy HH:mm');
  };

  return (
    <Box display="flex" flexWrap="wrap" gap={3}>
      {/* Header */}
      <Box width="100%">
        <Paper sx={{ p: 2 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Evaluation Schedules</Typography>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={handleCreateSchedule}
            >
              Create Schedule
            </Button>
          </Box>
        </Paper>
      </Box>

      {/* Active Schedules */}
      <Box width="100%">
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Active Schedules ({schedules.filter((s) => s.enabled).length})
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Pattern</TableCell>
                  <TableCell>Frequency</TableCell>
                  <TableCell>Next Run</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Enabled</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {schedules.map((schedule) => (
                  <TableRow key={schedule.id}>
                    <TableCell>{schedule.name}</TableCell>
                    <TableCell>
                      <Chip label={schedule.pattern} size="small" />
                    </TableCell>
                    <TableCell>{schedule.frequency}</TableCell>
                    <TableCell>{getNextRunText(schedule)}</TableCell>
                    <TableCell>
                      <Chip
                        label={schedule.status}
                        color={getStatusColor(schedule.status) as 'default' | 'primary' | 'success' | 'error'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={schedule.enabled}
                        onChange={() => handleToggleSchedule(schedule.id)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        onClick={() => handleRunNow(schedule)}
                        disabled={schedule.status === 'running'}
                      >
                        <PlayArrow />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleEditSchedule(schedule)}
                      >
                        <Edit />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteSchedule(schedule.id)}
                        color="error"
                      >
                        <Delete />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Box>

      {/* Schedule Statistics */}
      <Box flex={{ xs: '0 0 100%', md: '0 0 calc(33.333% - 16px)' }}>
        <Paper sx={{ p: 2 }}>
          <Box display="flex" alignItems="center" gap={1} mb={2}>
            <Schedule color="primary" />
            <Typography variant="h6">Schedule Overview</Typography>
          </Box>
          <List dense>
            <ListItem>
              <ListItemText primary="Total Schedules" />
              <ListItemSecondaryAction>
                <Typography variant="h6">{schedules.length}</Typography>
              </ListItemSecondaryAction>
            </ListItem>
            <ListItem>
              <ListItemText primary="Active Schedules" />
              <ListItemSecondaryAction>
                <Typography variant="h6">
                  {schedules.filter((s) => s.enabled).length}
                </Typography>
              </ListItemSecondaryAction>
            </ListItem>
            <ListItem>
              <ListItemText primary="Running Now" />
              <ListItemSecondaryAction>
                <Typography variant="h6">
                  {schedules.filter((s) => s.status === 'running').length}
                </Typography>
              </ListItemSecondaryAction>
            </ListItem>
          </List>
        </Paper>
      </Box>

      {/* Recent Runs */}
      <Box flex={{ xs: '0 0 100%', md: '0 0 calc(66.666% - 8px)' }}>
        <Paper sx={{ p: 2 }}>
          <Box display="flex" alignItems="center" gap={1} mb={2}>
            <History color="primary" />
            <Typography variant="h6">Recent Schedule Runs</Typography>
          </Box>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Schedule</TableCell>
                  <TableCell>Start Time</TableCell>
                  <TableCell>Duration</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Evaluations</TableCell>
                  <TableCell>Avg Score</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {scheduleRuns.slice(0, 5).map((run) => {
                  const schedule = schedules.find((s) => s.id === run.scheduleId);
                  const duration = run.endTime
                    ? Math.round(
                        (run.endTime.getTime() - run.startTime.getTime()) / 1000 / 60
                      )
                    : null;
                  return (
                    <TableRow key={run.id}>
                      <TableCell>{schedule?.name || 'Unknown'}</TableCell>
                      <TableCell>{format(run.startTime, 'MMM dd HH:mm')}</TableCell>
                      <TableCell>
                        {duration !== null ? `${duration} min` : 'Running...'}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={run.status}
                          color={getStatusColor(run.status) as 'default' | 'primary' | 'success' | 'error'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{run.evaluationCount}</TableCell>
                      <TableCell>
                        {run.averageScore
                          ? `${(run.averageScore * 100).toFixed(1)}%`
                          : '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Box>

      {/* Upcoming Runs */}
      <Box width="100%">
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Upcoming Runs
          </Typography>
          <Alert severity="info" icon={<Notifications />}>
            <Typography variant="body2">
              Next scheduled run:{' '}
              <strong>
                {schedules
                  .filter((s) => s.enabled && !isPast(s.nextRun))
                  .sort((a, b) => a.nextRun.getTime() - b.nextRun.getTime())[0]
                  ?.name || 'No upcoming runs'}
              </strong>
            </Typography>
          </Alert>
        </Paper>
      </Box>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingSchedule ? 'Edit Schedule' : 'Create New Schedule'}
        </DialogTitle>
        <DialogContent>
          <Box display="flex" flexWrap="wrap" gap={2} sx={{ mt: 1 }}>
            <Box width="100%">
              <TextField
                fullWidth
                label="Schedule Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </Box>
            <Box flex={{ xs: '0 0 100%', sm: '0 0 calc(50% - 8px)' }}>
              <FormControl fullWidth>
                <InputLabel>Pattern</InputLabel>
                <Select
                  value={formData.pattern}
                  onChange={(e: SelectChangeEvent) =>
                    setFormData({ ...formData, pattern: e.target.value })
                  }
                  label="Pattern"
                >
                  {PATTERNS.map((pattern) => (
                    <MenuItem key={pattern} value={pattern}>
                      {pattern}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <Box flex={{ xs: '0 0 100%', sm: '0 0 calc(50% - 8px)' }}>
              <FormControl fullWidth>
                <InputLabel>Frequency</InputLabel>
                <Select
                  value={formData.frequency}
                  onChange={(e: SelectChangeEvent) =>
                    setFormData({
                      ...formData,
                      frequency: e.target.value as EvaluationSchedule['frequency'],
                    })
                  }
                  label="Frequency"
                >
                  <MenuItem value="once">Once</MenuItem>
                  <MenuItem value="hourly">Hourly</MenuItem>
                  <MenuItem value="daily">Daily</MenuItem>
                  <MenuItem value="weekly">Weekly</MenuItem>
                  <MenuItem value="monthly">Monthly</MenuItem>
                </Select>
              </FormControl>
            </Box>
            <Box width="100%">
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DateTimePicker
                  label="Next Run"
                  value={formData.nextRun}
                  onChange={(newValue) =>
                    newValue && setFormData({ ...formData, nextRun: newValue })
                  }
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </LocalizationProvider>
            </Box>
            <Box width="100%">
              <TextField
                fullWidth
                label="Notification Email (optional)"
                type="email"
                value={formData.notificationEmail || ''}
                onChange={(e) =>
                  setFormData({ ...formData, notificationEmail: e.target.value })
                }
              />
            </Box>
            <Box width="100%">
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.enabled}
                    onChange={(e) =>
                      setFormData({ ...formData, enabled: e.target.checked })
                    }
                  />
                }
                label="Enable Schedule"
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveSchedule}>
            {editingSchedule ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}