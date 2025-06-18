import { Injectable, Logger, HttpException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  ApiEndpointTest,
  ApiTestResult,
  StreamData,
  EndpointHealth,
  ApiClientConfig,
} from '../interfaces/api-testing.interface';
import { AgentPattern } from '../../enums/agent-pattern.enum';

@Injectable()
export class ApiTestingService {
  private readonly logger = new Logger(ApiTestingService.name);
  private readonly endpointMap: Map<AgentPattern, string>;
  private readonly healthCache = new Map<string, EndpointHealth>();

  constructor(private readonly httpService: HttpService) {
    this.endpointMap = new Map([
      [AgentPattern.SEQUENTIAL_PROCESSING, '/api/sequential-processing/stream'],
      [AgentPattern.ROUTING, '/api/routing/stream'],
      [AgentPattern.PARALLEL_PROCESSING, '/api/parallel-processing/stream'],
      [AgentPattern.ORCHESTRATOR_WORKER, '/api/orchestrator-worker/stream'],
      [AgentPattern.EVALUATOR_OPTIMIZER, '/api/evaluator-optimizer/stream'],
      [AgentPattern.MULTI_STEP_TOOL_USAGE, '/api/multi-step-tool-usage/stream'],
    ]);
  }

  async testEndpoint(test: ApiEndpointTest, config: ApiClientConfig): Promise<ApiTestResult> {
    const startTime = Date.now();
    const endpoint = test.endpoint || this.endpointMap.get(test.pattern);

    if (!endpoint) {
      throw new Error(`No endpoint configured for pattern ${test.pattern}`);
    }

    const url = `${config.baseUrl}${endpoint}`;

    try {
      if (this.isStreamingEndpoint(endpoint)) {
        return await this.testStreamingEndpoint(test, url, config, startTime);
      } else {
        return await this.testRegularEndpoint(test, url, config, startTime);
      }
    } catch (error) {
      this.logger.error(`API test failed for ${test.pattern}`, error);

      return {
        pattern: test.pattern,
        endpoint,
        status: error.response?.status || 0,
        headers: error.response?.headers || {},
        body: error.response?.data || null,
        latency: Date.now() - startTime,
        error: {
          message: error.message,
          code: error.code,
          stack: error.stack,
        },
      };
    }
  }

  async testStreamingEndpoint(
    test: ApiEndpointTest,
    url: string,
    config: ApiClientConfig,
    startTime: number,
  ): Promise<ApiTestResult> {
    const streamData: StreamData[] = [];

    const response = await fetch(url, {
      method: test.method,
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
        ...test.headers,
      },
      body: test.body ? JSON.stringify(test.body) : undefined,
    });

    if (!response.ok) {
      throw new HttpException(`Stream request failed: ${response.statusText}`, response.status);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullData = '';

    if (reader) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          fullData += chunk;

          streamData.push({
            timestamp: Date.now(),
            chunk: chunk,
            size: value.byteLength,
          });
        }
      } finally {
        reader.releaseLock();
      }
    }

    const parsedData = this.parseStreamData(fullData);

    return {
      pattern: test.pattern,
      endpoint: test.endpoint || this.endpointMap.get(test.pattern)!,
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body: parsedData,
      streamData,
      latency: Date.now() - startTime,
    };
  }

  async testRegularEndpoint(
    test: ApiEndpointTest,
    url: string,
    config: ApiClientConfig,
    startTime: number,
  ): Promise<ApiTestResult> {
    const requestConfig = {
      headers: {
        ...config.headers,
        ...test.headers,
      },
      timeout: test.timeout || config.timeout,
    };

    const response = await firstValueFrom(
      test.method === 'POST'
        ? this.httpService.post(url, test.body, requestConfig)
        : this.httpService.get(url, requestConfig),
    );

    return {
      pattern: test.pattern,
      endpoint: test.endpoint || this.endpointMap.get(test.pattern)!,
      status: response.status,
      headers: response.headers as Record<string, string>,
      body: response.data,
      latency: Date.now() - startTime,
    };
  }

  async checkEndpointHealth(
    pattern: AgentPattern,
    config: ApiClientConfig,
  ): Promise<EndpointHealth> {
    const endpoint = this.endpointMap.get(pattern);
    if (!endpoint) {
      throw new Error(`No endpoint configured for pattern ${pattern}`);
    }

    const cacheKey = `${pattern}-${endpoint}`;
    const cached = this.healthCache.get(cacheKey);

    if (cached && Date.now() - cached.lastChecked.getTime() < 60000) {
      return cached;
    }

    const startTime = Date.now();
    const url = `${config.baseUrl}${endpoint}`;

    try {
      const response = await firstValueFrom(
        this.httpService.head(url, {
          timeout: 5000,
        }),
      );

      const health: EndpointHealth = {
        pattern,
        endpoint,
        healthy: response.status === 200 || response.status === 204,
        lastChecked: new Date(),
        responseTime: Date.now() - startTime,
      };

      this.healthCache.set(cacheKey, health);
      return health;
    } catch (error) {
      const health: EndpointHealth = {
        pattern,
        endpoint,
        healthy: false,
        lastChecked: new Date(),
        responseTime: Date.now() - startTime,
        error: error.message,
      };

      this.healthCache.set(cacheKey, health);
      return health;
    }
  }

  async checkAllEndpointsHealth(config: ApiClientConfig): Promise<EndpointHealth[]> {
    const patterns = Array.from(this.endpointMap.keys());
    const healthChecks = await Promise.all(
      patterns.map((pattern) => this.checkEndpointHealth(pattern, config)),
    );
    return healthChecks;
  }

  private isStreamingEndpoint(endpoint: string): boolean {
    return endpoint.includes('/stream');
  }

  private parseStreamData(data: string): any {
    const lines = data.split('\n').filter((line) => line.trim());
    const objects: any[] = [];

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const jsonData = JSON.parse(line.slice(6));
          objects.push(jsonData);
        } catch (error) {
          this.logger.warn(`Failed to parse stream data: ${line}`);
        }
      }
    }

    return objects.length === 1 ? objects[0] : objects;
  }

  async captureRequestResponse(
    test: ApiEndpointTest,
    config: ApiClientConfig,
  ): Promise<{
    request: any;
    response: ApiTestResult;
    timing: {
      dns?: number;
      tcp?: number;
      tls?: number;
      firstByte?: number;
      download?: number;
      total: number;
    };
  }> {
    const timing = {
      start: Date.now(),
      total: 0,
    };

    const request = {
      url: `${config.baseUrl}${test.endpoint || this.endpointMap.get(test.pattern)}`,
      method: test.method,
      headers: {
        ...config.headers,
        ...test.headers,
      },
      body: test.body,
      timestamp: new Date(),
    };

    const response = await this.testEndpoint(test, config);

    timing.total = Date.now() - timing.start;

    return {
      request,
      response,
      timing: {
        total: timing.total,
      },
    };
  }
}
