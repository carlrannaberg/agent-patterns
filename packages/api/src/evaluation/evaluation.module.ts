import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EvaluationService } from './services/evaluation.service';
import { LlmJudgeService } from './services/llm-judge.service';
import { GEvalService } from './services/g-eval.service';
import { TestCaseService } from './services/test-case.service';
import { ReliabilityService } from './services/reliability.service';
import { EvaluationConfigService } from './services/evaluation-config.service';

@Module({
  imports: [ConfigModule],
  providers: [
    EvaluationService,
    LlmJudgeService,
    GEvalService,
    TestCaseService,
    ReliabilityService,
    EvaluationConfigService,
  ],
  exports: [EvaluationService, TestCaseService, EvaluationConfigService],
})
export class EvaluationModule {}
