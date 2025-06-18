import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { EvaluationBatch } from './evaluation-batch.entity';
import { MetricScore } from './metric-score.entity';

@Entity('evaluation_results')
@Index(['patternType', 'createdAt'])
@Index(['testCaseId', 'createdAt'])
@Index(['overallScore'])
@Index(['createdAt'])
export class EvaluationResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'pattern_type' })
  @Index()
  patternType: string;

  @Column({ name: 'test_case_id' })
  testCaseId: string;

  @Column({ type: 'jsonb' })
  input: Record<string, any>;

  @Column({ type: 'jsonb' })
  output: Record<string, any>;

  @Column({ type: 'float', name: 'overall_score' })
  overallScore: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  error: string;

  @Column({ default: true })
  success: boolean;

  @Column({ type: 'float', name: 'execution_time_ms' })
  executionTimeMs: number;

  @Column({ type: 'jsonb', name: 'llm_metadata', nullable: true })
  llmMetadata: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };

  @Column({ name: 'evaluation_method' })
  evaluationMethod: string;

  @Column({ type: 'jsonb', name: 'evaluator_config', nullable: true })
  evaluatorConfig: Record<string, any>;

  @ManyToOne(() => EvaluationBatch, (batch) => batch.results, {
    nullable: true,
  })
  @JoinColumn({ name: 'batch_id' })
  batch: EvaluationBatch;

  @Column({ name: 'batch_id', nullable: true })
  batchId: string;

  @OneToMany(() => MetricScore, (metric) => metric.evaluationResult, {
    cascade: true,
    eager: true,
  })
  metrics: MetricScore[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
