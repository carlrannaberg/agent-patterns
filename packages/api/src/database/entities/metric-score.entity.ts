import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { EvaluationResult } from './evaluation-result.entity';

@Entity('metric_scores')
@Index(['evaluationResultId', 'name'])
@Index(['name', 'score'])
export class MetricScore {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  name: string;

  @Column({ type: 'float' })
  score: number;

  @Column({ type: 'float', nullable: true })
  weight: number;

  @Column({ type: 'text', nullable: true })
  feedback: string;

  @Column({ type: 'jsonb', nullable: true })
  details: Record<string, any>;

  @ManyToOne(() => EvaluationResult, (result) => result.metrics, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'evaluation_result_id' })
  evaluationResult: EvaluationResult;

  @Column({ name: 'evaluation_result_id' })
  evaluationResultId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
