import {
  IsOptional,
  IsString,
  IsBoolean,
  IsNumber,
  IsEnum,
  IsDateString,
  Min,
  Max,
  IsArray,
  IsObject,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class EvaluationResultsQueryDto {
  @IsOptional()
  @IsString()
  patternType?: string;

  @IsOptional()
  @IsString()
  testCaseId?: string;

  @IsOptional()
  @IsString()
  batchId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseFloat(value))
  @Min(0)
  @Max(1)
  minScore?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseFloat(value))
  @Min(0)
  @Max(1)
  maxScore?: number;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  success?: boolean;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseInt(value))
  @Min(1)
  @Max(1000)
  limit?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseInt(value))
  @Min(0)
  offset?: number;

  @IsOptional()
  @IsEnum(['createdAt', 'overallScore'])
  orderBy?: 'createdAt' | 'overallScore';

  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  orderDirection?: 'ASC' | 'DESC';
}

export class TimeSeriesQueryDto {
  @IsString()
  patternType: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsEnum(['hour', 'day', 'week', 'month'])
  groupBy?: 'hour' | 'day' | 'week' | 'month';

  @IsOptional()
  @IsEnum(['hour', 'day', 'week'])
  interval?: 'hour' | 'day' | 'week';
}

export class CreateAlertDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  patternType?: string;

  @IsEnum(['score_degradation', 'failure_rate', 'performance', 'anomaly'])
  alertType: 'score_degradation' | 'failure_rate' | 'performance' | 'anomaly';

  @IsObject()
  conditions: {
    metric?: string;
    operator: 'lt' | 'gt' | 'lte' | 'gte' | 'eq' | 'neq';
    threshold: number;
    windowSize?: number;
    windowUnit?: 'minutes' | 'hours' | 'days';
    consecutiveBreaches?: number;
  };

  @IsArray()
  notificationChannels: Array<{
    type: 'email' | 'slack' | 'webhook' | 'log';
    config: Record<string, any>;
  }>;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsEnum(['low', 'medium', 'high', 'critical'])
  severity?: 'low' | 'medium' | 'high' | 'critical';

  @IsOptional()
  @IsNumber()
  @Min(0)
  cooldownMinutes?: number;
}

export class GenerateReportDto {
  @IsEnum(['summary', 'detailed', 'comparison', 'trend', 'failure'])
  reportType: 'summary' | 'detailed' | 'comparison' | 'trend' | 'failure';

  @IsEnum(['pdf', 'json', 'csv'])
  format: 'pdf' | 'json' | 'csv';

  @IsOptional()
  @IsString()
  patternType?: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  metrics?: string[];

  @IsOptional()
  @IsObject()
  customOptions?: Record<string, any>;
}
