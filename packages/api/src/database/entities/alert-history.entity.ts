import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { AlertConfiguration } from './alert-configuration.entity';

@Entity('alert_history')
@Index(['configurationId', 'triggeredAt'])
@Index(['status', 'triggeredAt'])
export class AlertHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => AlertConfiguration, (config) => config.alertHistory, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'configuration_id' })
  configuration: AlertConfiguration;

  @Column({ name: 'configuration_id' })
  configurationId: string;

  @Column({ name: 'triggered_at' })
  @Index()
  triggeredAt: Date;

  @Column({ type: 'jsonb', name: 'trigger_data' })
  triggerData: {
    currentValue: number;
    threshold: number;
    metric: string;
    patternType?: string;
    evaluationResultIds?: string[];
  };

  @Column({ default: 'triggered' })
  @Index()
  status: 'triggered' | 'acknowledged' | 'resolved' | 'escalated';

  @Column({ type: 'jsonb', name: 'notification_results', nullable: true })
  notificationResults: Array<{
    channel: string;
    success: boolean;
    error?: string;
    sentAt: Date;
  }>;

  @Column({ name: 'acknowledged_at', nullable: true })
  acknowledgedAt: Date;

  @Column({ name: 'acknowledged_by', nullable: true })
  acknowledgedBy: string;

  @Column({ name: 'resolved_at', nullable: true })
  resolvedAt: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
