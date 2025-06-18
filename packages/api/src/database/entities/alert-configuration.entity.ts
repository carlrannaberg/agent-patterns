import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { AlertHistory } from './alert-history.entity';

@Entity('alert_configurations')
@Index(['patternType', 'enabled'])
@Index(['alertType', 'enabled'])
export class AlertConfiguration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'pattern_type', nullable: true })
  @Index()
  patternType: string;

  @Column({ name: 'alert_type' })
  alertType: 'score_degradation' | 'failure_rate' | 'performance' | 'anomaly';

  @Column({ type: 'jsonb' })
  conditions: {
    metric?: string;
    operator: 'lt' | 'gt' | 'lte' | 'gte' | 'eq' | 'neq';
    threshold: number;
    windowSize?: number;
    windowUnit?: 'minutes' | 'hours' | 'days';
    consecutiveBreaches?: number;
  };

  @Column({ type: 'jsonb', name: 'notification_channels' })
  notificationChannels: Array<{
    type: 'email' | 'slack' | 'webhook' | 'log';
    config: Record<string, any>;
  }>;

  @Column({ default: true })
  @Index()
  enabled: boolean;

  @Column({ default: 'medium' })
  severity: 'low' | 'medium' | 'high' | 'critical';

  @Column({ type: 'int', name: 'cooldown_minutes', default: 60 })
  cooldownMinutes: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @OneToMany(() => AlertHistory, (history) => history.configuration, {
    cascade: true,
  })
  alertHistory: AlertHistory[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
