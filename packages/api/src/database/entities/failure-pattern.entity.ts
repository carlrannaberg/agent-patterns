import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('failure_patterns')
@Index(['patternType', 'category', 'createdAt'])
@Index(['occurrenceCount', 'createdAt'])
export class FailurePattern {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'pattern_type' })
  @Index()
  patternType: string;

  @Column()
  @Index()
  category: string;

  @Column({ name: 'sub_category', nullable: true })
  subCategory: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'text', name: 'error_signature' })
  errorSignature: string;

  @Column({ type: 'int', name: 'occurrence_count', default: 1 })
  occurrenceCount: number;

  @Column({ type: 'jsonb', name: 'example_cases' })
  exampleCases: Array<{
    testCaseId: string;
    evaluationResultId: string;
    timestamp: Date;
    context: Record<string, any>;
  }>;

  @Column({ type: 'jsonb', name: 'common_factors', nullable: true })
  commonFactors: {
    inputPatterns?: string[];
    configPatterns?: Record<string, any>;
    environmentFactors?: string[];
  };

  @Column({ type: 'jsonb', name: 'root_cause_analysis', nullable: true })
  rootCauseAnalysis: {
    identifiedCause?: string;
    confidence: number;
    evidence: string[];
    suggestedFixes: string[];
  };

  @Column({ type: 'float', name: 'impact_score' })
  impactScore: number;

  @Column({ default: 'active' })
  @Index()
  status: 'active' | 'resolved' | 'monitoring';

  @Column({ name: 'first_seen' })
  firstSeen: Date;

  @Column({ name: 'last_seen' })
  lastSeen: Date;

  @Column({ name: 'resolved_at', nullable: true })
  resolvedAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  remediation: {
    actions: string[];
    implementedFixes: string[];
    verificationResults: Record<string, any>;
  };

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
