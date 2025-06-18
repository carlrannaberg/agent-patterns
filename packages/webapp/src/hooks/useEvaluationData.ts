import { useState, useEffect, useCallback } from 'react';

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
      // Handle the API response structure and property mapping
      const data = apiResponse.data || apiResponse;

      // Map API response to expected frontend interface
      const mappedData: DashboardSummary = {
        totalEvaluations: data.totalEvaluations || 0,
        averageScore: data.averageScore || 0,
        successRate: data.successRate || 0,
        systemHealth: {
          status: data.systemHealth?.status || 'healthy',
          issues: data.systemHealth?.issues || []
        },
        patternPerformance: data.patternPerformance || [],
        topMetrics: data.topPerformingMetrics || [], // Map from API property name
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

  const fetchResults = useCallback(async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();

      if (params?.patternType) queryParams.append('patternType', params.patternType);
      if (params?.startDate) queryParams.append('startDate', params.startDate.toISOString());
      if (params?.endDate) queryParams.append('endDate', params.endDate.toISOString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());

      const response = await fetch(
        `${API_BASE_URL}/evaluation/reporting/results?${queryParams.toString()}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch results: ${response.statusText}`);
      }

      const apiResponse = await response.json();
      // Handle API response structure - extract array from response
      const resultsData = apiResponse.data || apiResponse;

      // Ensure we always have an array
      const resultsArray = Array.isArray(resultsData) ? resultsData : [];

      setResults(resultsArray);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      // Set empty array on error to prevent slice errors
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [params]);

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

  const fetchTimeSeries = useCallback(async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        patternType: params.patternType,
        startDate: params.startDate.toISOString(),
        endDate: params.endDate.toISOString(),
        interval: params.interval || 'day',
      });

      if (params.metric) queryParams.append('metric', params.metric);

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
  }, [params]);

  useEffect(() => {
    fetchTimeSeries();
  }, [fetchTimeSeries]);

  return { data, loading, error, refetch: fetchTimeSeries };
}
