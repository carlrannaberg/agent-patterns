import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity('quality_baselines')
@Unique(['patternType', 'metricName', 'periodType'])
@Index(['patternType', 'updatedAt'])
export class QualityBaseline {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'pattern_type' })
  @Index()
  patternType: string;

  @Column({ name: 'metric_name' })
  @Index()
  metricName: string;

  @Column({ name: 'period_type' })
  periodType: 'daily' | 'weekly' | 'monthly' | 'all_time';

  @Column({ type: 'float' })
  mean: number;

  @Column({ type: 'float' })
  median: number;

  @Column({ type: 'float', name: 'std_deviation' })
  stdDeviation: number;

  @Column({ type: 'float' })
  min: number;

  @Column({ type: 'float' })
  max: number;

  @Column({ type: 'float' })
  p25: number;

  @Column({ type: 'float' })
  p75: number;

  @Column({ type: 'float' })
  p90: number;

  @Column({ type: 'float' })
  p95: number;

  @Column({ type: 'float' })
  p99: number;

  @Column({ type: 'int', name: 'sample_count' })
  sampleCount: number;

  @Column({ type: 'jsonb', nullable: true })
  thresholds: {
    excellent: number;
    good: number;
    acceptable: number;
    poor: number;
  };

  @Column({ type: 'jsonb', nullable: true, name: 'trend_data' })
  trendData: {
    direction: 'improving' | 'stable' | 'degrading';
    changePercent: number;
    previousMean: number;
  };

  @Column({ name: 'calculated_at' })
  calculatedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
