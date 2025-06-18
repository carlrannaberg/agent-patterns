import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { EvaluationResult } from './evaluation-result.entity';

@Entity('evaluation_batches')
@Index(['patternType', 'createdAt'])
@Index(['status', 'createdAt'])
export class EvaluationBatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'pattern_type' })
  @Index()
  patternType: string;

  @Column({ default: 'pending' })
  @Index()
  status: 'pending' | 'running' | 'completed' | 'failed';

  @Column({ type: 'int', name: 'total_tests' })
  totalTests: number;

  @Column({ type: 'int', name: 'completed_tests', default: 0 })
  completedTests: number;

  @Column({ type: 'int', name: 'failed_tests', default: 0 })
  failedTests: number;

  @Column({ type: 'float', name: 'average_score', nullable: true })
  averageScore: number;

  @Column({ type: 'jsonb', nullable: true })
  summary: {
    scoreDistribution: Record<string, number>;
    metricAverages: Record<string, number>;
    executionStats: {
      totalTime: number;
      averageTime: number;
      minTime: number;
      maxTime: number;
    };
    errorCategories: Record<string, number>;
  };

  @Column({ type: 'jsonb', nullable: true })
  configuration: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'started_at', nullable: true })
  startedAt: Date;

  @Column({ name: 'completed_at', nullable: true })
  completedAt: Date;

  @OneToMany(() => EvaluationResult, (result) => result.batch, {
    cascade: true,
  })
  results: EvaluationResult[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
