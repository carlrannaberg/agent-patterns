import { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Tab,
  Tabs,
  CircularProgress,
  Alert,
} from '@mui/material';
import { DashboardOverview } from '../components/evaluation/DashboardOverview';
import { RealTimeMonitor } from '../components/evaluation/RealTimeMonitor';
import { HistoricalAnalysis } from '../components/evaluation/HistoricalAnalysis';
import { PatternComparison } from '../components/evaluation/PatternComparison';
import { FailureAnalysis } from '../components/evaluation/FailureAnalysis';
import { ScheduleManager } from '../components/evaluation/ScheduleManager';
import { useEvaluationData } from '../hooks/useEvaluationData';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`evaluation-tabpanel-${index}`}
      aria-labelledby={`evaluation-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export default function EvaluationDashboard() {
  const [activeTab, setActiveTab] = useState(0);
  const { dashboardData, loading, error, refetch } = useEvaluationData();

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  useEffect(() => {
    // Refresh data every 30 seconds
    const interval = setInterval(() => {
      refetch();
    }, 30000);

    return () => clearInterval(interval);
  }, [refetch]);

  if (loading && !dashboardData) {
    return (
      <Container maxWidth="xl">
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="xl">
        <Alert severity="error" sx={{ mt: 2 }}>
          Failed to load evaluation data: {error.message}
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Evaluation Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Monitor and analyze agent pattern performance metrics in real-time
        </Typography>
      </Box>

      <Paper sx={{ width: '100%', mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="Overview" />
          <Tab label="Real-Time Monitor" />
          <Tab label="Historical Analysis" />
          <Tab label="Pattern Comparison" />
          <Tab label="Failure Analysis" />
          <Tab label="Schedule Manager" />
        </Tabs>
      </Paper>

      <TabPanel value={activeTab} index={0}>
        <DashboardOverview data={dashboardData} />
      </TabPanel>

      <TabPanel value={activeTab} index={1}>
        <RealTimeMonitor />
      </TabPanel>

      <TabPanel value={activeTab} index={2}>
        <HistoricalAnalysis />
      </TabPanel>

      <TabPanel value={activeTab} index={3}>
        <PatternComparison />
      </TabPanel>

      <TabPanel value={activeTab} index={4}>
        <FailureAnalysis />
      </TabPanel>

      <TabPanel value={activeTab} index={5}>
        <ScheduleManager />
      </TabPanel>
    </Container>
  );
}