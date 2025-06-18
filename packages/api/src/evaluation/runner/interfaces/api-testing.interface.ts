import { AgentPattern } from '../../enums/agent-pattern.enum';

export interface ApiEndpointTest {
  pattern: AgentPattern;
  endpoint: string;
  method: 'POST' | 'GET';
  headers?: Record<string, string>;
  body?: any;
  expectedStatus?: number;
  timeout?: number;
}

export interface ApiTestResult {
  pattern: AgentPattern;
  endpoint: string;
  status: number;
  headers: Record<string, string>;
  body: any;
  streamData?: StreamData[];
  latency: number;
  error?: any;
}

export interface StreamData {
  timestamp: number;
  chunk: any;
  size: number;
}

export interface EndpointHealth {
  pattern: AgentPattern;
  endpoint: string;
  healthy: boolean;
  lastChecked: Date;
  responseTime: number;
  error?: string;
}

export interface ApiClientConfig {
  baseUrl: string;
  timeout: number;
  retries: number;
  retryDelay: number;
  headers?: Record<string, string>;
}
