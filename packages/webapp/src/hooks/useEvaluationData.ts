import { useState, useEffect, useCallback, useMemo } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface DashboardSummary {
  totalEvaluations: number;
  averageScore: number;
  successRate: number;
  systemHealth: {
    status: 'healthy' | 'degraded' | 'critical';
    issues: string[];
  };
  patternPerformance: Array<{
    pattern: string;
    evaluationCount: number;
    averageScore: number;
    successRate: number;
  }>;
  topMetrics: Array<{
    name: string;
    averageScore: number;
  }>;
  recentFailures: Array<{
    id: string;
    patternType: string;
    error: string;
    timestamp: string;
  }>;
}

export function useEvaluationData() {
  const [dashboardData, setDashboardData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/evaluation/reporting/dashboard/summary`);

      if (!response.ok) {
        throw new Error(`Failed to fetch dashboard data: ${response.statusText}`);
      }

      const apiResponse = await response.json();
      const data = apiResponse.data || apiResponse;

      const mappedData: DashboardSummary = {
        totalEvaluations: data.totalEvaluations || 0,
        averageScore: data.averageScore || 0,
        successRate: data.successRate || 0,
        systemHealth: {
          status: data.systemHealth?.status || 'healthy',
          issues: data.systemHealth?.issues || []
        },
        patternPerformance: data.patternPerformance || [],
        topMetrics: data.topPerformingMetrics || [],
        recentFailures: data.recentFailures || []
      };

      setDashboardData(mappedData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  return {
    dashboardData,
    loading,
    error,
    refetch: fetchDashboardData,
  };
}

interface EvaluationResult {
  id: string;
  patternType: string;
  overallScore: number;
  success: boolean;
  executionTimeMs: number;
  createdAt: string;
  testCaseId?: string;
  metrics?: Array<{
    name: string;
    score: number;
    weight?: number;
    feedback?: string;
  }>;
}

export function useEvaluationResults(params?: {
  patternType?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}) {
  const [results, setResults] = useState<EvaluationResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Memoize the params to prevent infinite loops
  const stableParams = useMemo(() => ({
    patternType: params?.patternType,
    startDate: params?.startDate?.toISOString(),
    endDate: params?.endDate?.toISOString(),
    limit: params?.limit,
  }), [params?.patternType, params?.startDate, params?.endDate, params?.limit]);

  const fetchResults = useCallback(async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();

      if (stableParams.patternType) queryParams.append('patternType', stableParams.patternType);
      if (stableParams.startDate) queryParams.append('startDate', stableParams.startDate);
      if (stableParams.endDate) queryParams.append('endDate', stableParams.endDate);
      if (stableParams.limit) queryParams.append('limit', stableParams.limit.toString());

      const response = await fetch(
        `${API_BASE_URL}/evaluation/reporting/results?${queryParams.toString()}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch results: ${response.statusText}`);
      }

      const apiResponse = await response.json();
      const resultsData = apiResponse.data || apiResponse;
      const resultsArray = Array.isArray(resultsData) ? resultsData : [];

      setResults(resultsArray);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [stableParams.patternType, stableParams.startDate, stableParams.endDate, stableParams.limit]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  return { results, loading, error, refetch: fetchResults };
}

interface TimeSeriesDataPoint {
  date: string;
  value: number;
  baseline?: number;
}

export function useTimeSeriesData(params: {
  patternType: string;
  startDate: Date;
  endDate: Date;
  interval?: 'hour' | 'day' | 'week';
  metric?: string;
}) {
  const [data, setData] = useState<TimeSeriesDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Memoize the params to prevent infinite loops
  const stableParams = useMemo(() => ({
    patternType: params.patternType,
    startDate: params.startDate.toISOString(),
    endDate: params.endDate.toISOString(),
    interval: params.interval || 'day',
    metric: params.metric,
  }), [params.patternType, params.startDate, params.endDate, params.interval, params.metric]);

  const fetchTimeSeries = useCallback(async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        patternType: stableParams.patternType,
        startDate: stableParams.startDate,
        endDate: stableParams.endDate,
        interval: stableParams.interval,
      });

      if (stableParams.metric) queryParams.append('metric', stableParams.metric);

      const response = await fetch(
        `${API_BASE_URL}/evaluation/reporting/metrics/time-series?${queryParams.toString()}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch time series: ${response.statusText}`);
      }

      const data = await response.json();
      setData(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [stableParams.patternType, stableParams.startDate, stableParams.endDate, stableParams.interval, stableParams.metric]);

  useEffect(() => {
    fetchTimeSeries();
  }, [fetchTimeSeries]);

  return { data, loading, error, refetch: fetchTimeSeries };
}
